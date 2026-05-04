const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const DtUserRepository = require("../../repositories/dtUser.repository");
const MailService = require("../../services/mail-service/mail-service");
const envConfig = require("../../config/envConfig");
const DomainToUserService = require("../../services/domain-to-user.service");
const {
  dtUserPasswordSchema,
  dtUserPasswordResetSchema,
} = require("../../utils/authValidator.js");
const EmailQueue = require("../../utils/emailQueue");
const DTUser = mongoose.model("DTUser");

class AuthService {
  constructor() {
    this.dtUserRepository = new DtUserRepository();
    this.repository = this.dtUserRepository;
    this.domainToUserService = DomainToUserService;
  }

  withTimeout(promise, timeoutMs, timeoutMessage) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
      ),
    ]);
  }

  sendVerificationEmailWithTimeout(email, fullName, userId, timeoutMs) {
    return this.withTimeout(
      MailService.sendVerificationEmail(email, fullName, userId),
      timeoutMs,
      "Email sending timeout",
    );
  }

  /**
   * Send verification emails to all unverified users.
   */
  async sendVerificationEmailsToUnverifiedUsers() {
    const unverifiedUsers = await this.repository.findUnverifiedUsers();

    if (unverifiedUsers.length === 0) {
      return {
        totalProcessed: 0,
        emailsSent: 0,
        emailsFailed: 0,
        users: [],
      };
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    const processedUsers = [];

    for (const user of unverifiedUsers) {
      try {
        await this.sendVerificationEmailWithTimeout(
          user.email,
          user.fullName,
          user._id.toString(),
          10000,
        );
        emailsSent++;

        processedUsers.push({
          name: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          emailSent: true,
        });
      } catch (emailError) {
        emailsFailed++;
        processedUsers.push({
          name: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          emailSent: false,
          error: emailError.message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      totalProcessed: unverifiedUsers.length,
      emailsSent,
      emailsFailed,
      users: processedUsers,
    };
  }

  /**
   * Create DTUser and send verification email with timeout.
   */
  async createDTUser(
    fullName,
    phone,
    email,
    domains,
    socialsFollowed,
    consent,
  ) {
    const existing = await this.repository.findByEmail(email);
    if (existing) {
      return { status: 400, reason: "exists" };
    }

    const newUser = await this.repository.createUser({
      fullName,
      phone,
      email,
      socialsFollowed,
      consent,
    });
    const domainIds = domains.map((domain) => domain.id);
    await this.domainToUserService.assignMultipleDomainsToUser(
      newUser._id,
      domainIds,
    );

    const emailPromise = this.sendVerificationEmailWithTimeout(
      newUser.email,
      newUser.fullName,
      newUser._id.toString(),
      15000,
    );

    return { newUser, emailPromise };
  }

  /**
   * Create DTUser and queue verification email.
   */
  async createDTUserWithBackgroundEmail(
    fullName,
    phone,
    email,
    domains,
    socialsFollowed,
    consent,
  ) {
    const existing = await this.repository.findByEmail(email);
    if (existing) {
      return { status: 400, reason: "exists" };
    }
    const newUser = await this.repository.createUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    EmailQueue.addEmail(newUser.email, newUser.fullName);

    return { newUser };
  }

  /**
   * Verify email by id and query email.
   */
  async verifyEmail({ id, email }) {
    const user = await this.repository.findById(id);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (user.email !== email) {
      return {
        status: 400,
        reason: "email_mismatch",
        expectedEmail: user.email,
      };
    }

    if (user.isEmailVerified) {
      return { status: 200, reason: "already_verified", user };
    }

    user.isEmailVerified = true;
    await this.repository.saveUser(user);
    return { status: 200, user };
  }

  /**
   * Setup password after verification.
   */
  async setupPassword({ userId, email, password, body }) {
    const { error } = dtUserPasswordSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (user.email !== email) {
      return { status: 400, reason: "email_mismatch" };
    }

    if (!user.isEmailVerified) {
      return { status: 400, reason: "not_verified" };
    }

    if (user.hasSetPassword) {
      return { status: 400, reason: "already_set" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.hasSetPassword = true;
    await this.repository.saveUser(user);

    return { user };
  }

  /**
   * Login DTUser.
   */
  async dtUserLogin(body) {
    const { email, password } = body;
    const user = await this.repository.findByEmail(email);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (!user.isEmailVerified) {
      try {
        await this.sendVerificationEmailWithTimeout(
          user.email,
          user.fullName,
          user._id.toString(),
          10000,
        );
        return { status: 400, reason: "verify_resend_success" };
      } catch (emailError) {
        return { status: 400, reason: "verify_resend_fail" };
      }
    }

    if (!user.hasSetPassword || !user.password) {
      return { status: 400, reason: "password_not_set", userId: user._id };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { status: 400, reason: "invalid_credentials" };
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return { user, token };
  }

  /**
   * Get current user info.
   */
  async me(email) {
    // const user = await this.repository.findByEmail(email);
    let user = await DTUser.findOne({ email })
      .populate({
        path: "userDomains",
        match: { deleted_at: null },
        populate: {
          path: "domain_child",
          select: "name",
        },
        // populate: [
        //   { path: "domain_category", select: "name" },
        //   { path: "domain_child", select: "name" },
        //   { path: "domain_sub_category", select: "name" }
        // ]
      })
      .lean()
      .exec();

    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
      },
      envConfig.jwt.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return { user, token };
  }

  /**
   * Get DTUser profile by id.
   */
  async getDTUserProfile(userId) {
    // Find user with populated userDomains (same as getAllDTUsers method)
    let user = await DTUser.findById(userId)
      .populate({
        path: "userDomains",
        match: { deleted_at: null },
        populate: {
          path: "domain_child",
          select: "name",
        },
      })
      .lean()
      .exec();

    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    // Transform userDomains to expected format (same as in getAllDTUsers)
    if (user.userDomains && user.userDomains.length > 0) {
      user.userDomains = user.userDomains.map((domain) => ({
        _id: domain.domain_child._id,
        name: domain.domain_child.name,
        assignmentId: domain._id, // Include assignment ID for removal
      }));
    } else {
      user.userDomains = [];
    }

    return { user };
  }

  /**
   * Update DTUser profile.
   */
  async updateDTUserProfile({ userId, requesterId, body, user }) {
    if (requesterId !== userId) {
      return { status: 403, reason: "forbidden" };
    }

    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (
      user.annotatorStatus !== "verified" &&
      user.annotatorStatus !== "approved"
    ) {
      return {
        status: 403,
        reason: "not_verified",
        currentStatus: user.annotatorStatus,
      };
    }

    const updateData = {};

    if (body.personalInfo) {
      updateData.personal_info = {
        ...user.personal_info,
        country:
          body.personalInfo.country !== undefined
            ? body.personalInfo.country
            : user.personal_info?.country,
        time_zone:
          body.personalInfo.timeZone !== undefined
            ? body.personalInfo.timeZone
            : user.personal_info?.time_zone,
        available_hours_per_week:
          body.personalInfo.availableHoursPerWeek !== undefined
            ? body.personalInfo.availableHoursPerWeek
            : user.personal_info?.available_hours_per_week,
        preferred_communication_channel:
          body.personalInfo.preferredCommunicationChannel !== undefined
            ? body.personalInfo.preferredCommunicationChannel
            : user.personal_info?.preferred_communication_channel,
      };
    }

    if (body.paymentInfo) {
      updateData.payment_info = {
        ...user.payment_info,
        account_name:
          body.paymentInfo.accountName !== undefined
            ? body.paymentInfo.accountName
            : user.payment_info?.account_name,
        account_number:
          body.paymentInfo.accountNumber !== undefined
            ? body.paymentInfo.accountNumber
            : user.payment_info?.account_number,
        bank_name:
          body.paymentInfo.bankName !== undefined
            ? body.paymentInfo.bankName
            : user.payment_info?.bank_name,
        bank_code:
          body.paymentInfo.bankCode !== undefined
            ? body.paymentInfo.bankCode
            : user.payment_info?.bank_code,
        bank_slug:
          body.paymentInfo.bank_slug !== undefined
            ? body.paymentInfo.bank_slug
            : user.payment_info?.bank_slug,
        payment_method:
          body.paymentInfo.paymentMethod !== undefined
            ? body.paymentInfo.paymentMethod
            : user.payment_info?.payment_method,
        payment_currency:
          body.paymentInfo.paymentCurrency !== undefined
            ? body.paymentInfo.paymentCurrency
            : user.payment_info?.payment_currency,
      };
    }

    if (body.professionalBackground) {
      updateData.professional_background = {
        ...user.professional_background,
        education_field:
          body.professionalBackground.educationField !== undefined
            ? body.professionalBackground.educationField
            : user.professional_background?.education_field,
        years_of_experience:
          body.professionalBackground.yearsOfExperience !== undefined
            ? body.professionalBackground.yearsOfExperience
            : user.professional_background?.years_of_experience,
        annotation_experience_types:
          body.professionalBackground.annotationExperienceTypes !== undefined
            ? body.professionalBackground.annotationExperienceTypes
            : user.professional_background?.annotation_experience_types,
      };
    }

    if (body.toolExperience !== undefined) {
      updateData.tool_experience = body.toolExperience;
    }

    if (body.annotationSkills !== undefined) {
      updateData.annotation_skills = body.annotationSkills;
    }

    if (body.languageProficiency) {
      updateData.language_proficiency = {
        ...user.language_proficiency,
        primary_language:
          body.languageProficiency.primaryLanguage !== undefined
            ? body.languageProficiency.primaryLanguage
            : user.language_proficiency?.primary_language,
        native_languages:
          body.languageProficiency.nativeLanguages !== undefined
            ? body.languageProficiency.nativeLanguages
            : user.language_proficiency?.native_languages,
        other_languages:
          body.languageProficiency.otherLanguages !== undefined
            ? body.languageProficiency.otherLanguages
            : user.language_proficiency?.other_languages,
        english_fluency_level:
          body.languageProficiency.englishFluencyLevel !== undefined
            ? body.languageProficiency.englishFluencyLevel
            : user.language_proficiency?.english_fluency_level,
      };
    }

    if (body.systemInfo) {
      updateData.system_info = {
        ...user.system_info,
        device_type:
          body.systemInfo.deviceType !== undefined
            ? body.systemInfo.deviceType
            : user.system_info?.device_type,
        operating_system:
          body.systemInfo.operatingSystem !== undefined
            ? body.systemInfo.operatingSystem
            : user.system_info?.operating_system,
        internet_speed_mbps:
          body.systemInfo.internetSpeedMbps !== undefined
            ? body.systemInfo.internetSpeedMbps
            : user.system_info?.internet_speed_mbps,
        power_backup:
          body.systemInfo.powerBackup !== undefined
            ? body.systemInfo.powerBackup
            : user.system_info?.power_backup,
        has_webcam:
          body.systemInfo.hasWebcam !== undefined
            ? body.systemInfo.hasWebcam
            : user.system_info?.has_webcam,
        has_microphone:
          body.systemInfo.hasMicrophone !== undefined
            ? body.systemInfo.hasMicrophone
            : user.system_info?.has_microphone,
      };
    }

    if (body.projectPreferences) {
      updateData.project_preferences = {
        ...user.project_preferences,
        domains_of_interest: user.project_preferences?.domains_of_interest,
        availability_type:
          body.projectPreferences.availabilityType !== undefined
            ? body.projectPreferences.availabilityType
            : user.project_preferences?.availability_type,
        nda_signed:
          body.projectPreferences.ndaSigned !== undefined
            ? body.projectPreferences.ndaSigned
            : user.project_preferences?.nda_signed,
      };
    }

    if (body.attachments) {
      updateData.attachments = {
        ...user.attachments,
        resume_url:
          body.attachments.resumeUrl !== undefined
            ? body.attachments.resumeUrl
            : user.attachments?.resume_url,
        id_document_url:
          body.attachments.idDocumentUrl !== undefined
            ? body.attachments.idDocumentUrl
            : user.attachments?.id_document_url,
        work_samples_url:
          body.attachments.workSamplesUrl !== undefined
            ? body.attachments.workSamplesUrl
            : user.attachments?.work_samples_url,
      };
    }

    // Perform the update
    let updatedUser = await DTUser.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate({
        path: "userDomains",
        match: { deleted_at: null },
        populate: {
          path: "domain_child",
          select: "name",
        },
      })
      .exec();

    updatedUser = {
      ...updatedUser,
      domains: undefined,
      userDomains: updatedUser.userDomains.map((domain) => ({
        _id: domain.domain_child._id,
        name: domain.domain_child.name,
        assignmentId: domain._id,
      })),
    };

    return { updatedUser };
  }

  /**
   * Reset DTUser password with old password check.
   */
  async resetDTUserPassword({ userId, body }) {
    const { error } = dtUserPasswordResetSchema.validate(body);
    if (error) {
      return {
        status: 400,
        reason: "validation",
        message: error.details[0].message,
      };
    }

    const { oldPassword, newPassword } = body;
    const user = await this.repository.findById(userId);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (!user.hasSetPassword || !user.password) {
      return { status: 400, reason: "no_password" };
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return { status: 400, reason: "invalid_old_password" };
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return { status: 400, reason: "same_password" };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    await this.repository.saveUser(user);

    return { user };
  }

  /**
   * Resend verification email.
   */
  async resendVerificationEmail(email) {
    const user = await this.repository.findByEmail(email);
    if (!user) {
      return { status: 404, reason: "not_found" };
    }

    if (user.isEmailVerified) {
      return { status: 400, reason: "already_verified" };
    }

    const emailPromise = this.sendVerificationEmailWithTimeout(
      user.email,
      user.fullName,
      user._id,
      15000,
    );

    return { user, emailPromise };
  }
}

module.exports = new AuthService();
