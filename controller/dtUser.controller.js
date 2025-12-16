const DTUser = require("../models/dtUser.model");
const AnnotationProject = require("../models/annotationProject.model");
const ProjectApplication = require("../models/projectApplication.model");
const Invoice = require("../models/invoice.model");
const mongoose = require("mongoose");
const { sendVerificationEmail } = require("../utils/mailer");
const { emailQueue } = require("../utils/emailQueue");
const { dtUserPasswordSchema, dtUserLoginSchema, dtUserProfileUpdateSchema, adminCreateSchema, adminVerificationRequestSchema, adminVerificationConfirmSchema, dtUserPasswordResetSchema } = require("../utils/authValidator");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendAdminVerificationEmail } = require("../utils/adminMailer");
const { sendAnnotatorApprovalEmail, sendAnnotatorRejectionEmail } = require("../utils/annotatorMailer");
const adminVerificationStore = require("../utils/adminVerificationStore");

// Option 1: Send email with timeout (current implementation)
const createDTUser = async (req, res) => {
  try {
    const { fullName, phone, email, domains, socialsFollowed, consent } = req.body;

    // 1️⃣ Check if user already exists
    const existing = await DTUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // 2️⃣ Create new user
    const newUser = new DTUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    // 3️⃣ Save user to database
    const savedUser = await newUser.save();

    // 4️⃣ Send verification email asynchronously with timeout
    const emailPromise = Promise.race([
      sendVerificationEmail(savedUser.email, savedUser.fullName, savedUser._id),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout')), 15000)
      )
    ]);

    try {
      await emailPromise;
      console.log(`✅ Verification email sent successfully to ${savedUser.email}`);
      
      res.status(201).json({
        message: "User created successfully. Verification email sent.",
        user: savedUser,
      });
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError.message);
      
      // Still respond with success since user was created
      res.status(201).json({
        message: "User created successfully. However, there was an issue sending the verification email. Please contact support.",
        user: savedUser,
        emailSent: false,
        emailError: emailError.message
      });
    }

  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Option 2: Background email sending (recommended for production)
const createDTUserWithBackgroundEmail = async (req, res) => {
  try {
    const { fullName, phone, email, domains, socialsFollowed, consent } = req.body;

    // 1️⃣ Check if user already exists
    const existing = await DTUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // 2️⃣ Create new user
    const newUser = new DTUser({
      fullName,
      phone,
      email,
      domains,
      socialsFollowed,
      consent,
    });

    // 3️⃣ Save user to database
    const savedUser = await newUser.save();

    // 4️⃣ Queue verification email for background processing
    emailQueue.addEmail(savedUser.email, savedUser.fullName);

    // 5️⃣ Respond immediately without waiting for email
    res.status(201).json({
      message: "User created successfully. Verification email will be sent shortly.",
      user: savedUser,
    });

  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Email verification function
const verifyEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    console.log(`🔍 Attempting to verify email for user ID: ${id}, email: ${email}`);

    // Find user by ID and email for extra security
    const user = await DTUser.findById(id);
    
    if (!user) {
      console.log(`❌ User not found with ID: ${id}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Verify email matches
    if (user.email !== email) {
      console.log(`❌ Email mismatch for user ${id}. Expected: ${user.email}, Got: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid verification link" 
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      console.log(`✅ Email already verified for user: ${email}`);
      return res.status(200).json({ 
        success: true,
        message: "Email is already verified",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified
        }
      });
    }

    // Update user verification status
    user.isEmailVerified = true;
    await user.save();

    console.log(`✅ Email successfully verified for user: ${email}`);

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error("❌ Error verifying email:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
      error: error.message,
    });
  }
};

// Password setup function (after email verification)
const setupPassword = async (req, res) => {
  try {
    // Validate input
    const { error } = dtUserPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { userId, email, password } = req.body;

    console.log(`🔐 Setting up password for user ID: ${userId}, email: ${email}`);

    // Find user by ID and email for extra security
    const user = await DTUser.findById(userId);
    
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Verify email matches
    if (user.email !== email) {
      console.log(`❌ Email mismatch for user ${userId}. Expected: ${user.email}, Got: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid request" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log(`❌ Email not verified for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Email must be verified before setting up password" 
      });
    }

    // Check if password already set
    if (user.hasSetPassword) {
      console.log(`⚠️ Password already set for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Password has already been set. Use login instead." 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with password
    user.password = hashedPassword;
    user.hasSetPassword = true;
    await user.save();

    console.log(`✅ Password successfully set for user: ${email}`);

    res.status(200).json({
      success: true,
      message: "Password set successfully! You can now login.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        domains: user.domains,
        socialsFollowed: user.socialsFollowed,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error setting up password:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password setup",
      error: error.message,
    });
  }
};

// DTUser login function
const dtUserLogin = async (req, res) => {
  try {
    // Validate input
    const { error } = dtUserLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email, password } = req.body;

    console.log(`🔐 Login attempt for email: ${email}`);

    // Find user by email
    const user = await DTUser.findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log(`❌ Email not verified for user: ${email}`);
      
      // Automatically resend verification email
      try {
        console.log(`📧 Resending verification email to: ${email}`);
        
        // Send verification email with timeout
        const emailPromise = Promise.race([
          sendVerificationEmail(user.email, user.fullName, user._id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email sending timeout')), 10000)
          )
        ]);
        
        await emailPromise;
        console.log(`✅ Verification email resent successfully to: ${email}`);
        
        return res.status(400).json({ 
          success: false,
          message: "Please verify your email first. A new verification email has been sent to your inbox.",
          emailResent: true
        });
        
      } catch (emailError) {
        console.error(`❌ Failed to resend verification email to ${email}:`, emailError.message);
        
        return res.status(400).json({ 
          success: false,
          message: "Please verify your email first. Unable to resend verification email at this time.",
          emailResent: false
        });
      }
    }

    // Check if password is set
    if (!user.hasSetPassword || !user.password) {
      console.log(`❌ Password not set for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Please set up your password first",
        requiresPasswordSetup: true,
        userId: user._id
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`❌ Invalid password for user: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    console.log(`✅ Successful login for user: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName
      },
      process.env.JWT_SECRET || 'your-secret-key', // Use environment variable for production
      { expiresIn: '7d' } // Token expires in 7 days
    );

    console.log(`🎟️ JWT token generated for user: ${email}`);

    // Return user data with JWT token in frontend-expected format
    res.status(200).json({
      success: true,
      message: "Login successful",
      _usrinfo: {
        data: token // Token stored in the format frontend expects for sessionStorage
      },
      token: token, // Also include token directly for backwards compatibility
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        domains: user.domains,
        socialsFollowed: user.socialsFollowed,
        consent: user.consent,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        resultLink: user.resultLink,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error during DTUser login:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

// Get DTUser profile by userId
const getDTUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`📋 Fetching profile for user ID: ${userId}`);

    // Find user by ID
    const user = await DTUser.findById(userId);
    
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    console.log(`✅ Profile found for user: ${user.email}`);

    // Structure the response in camelCase format with all requested fields
    const profileData = {
      // Basic user information
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      domains: user.domains,
      consent: user.consent,
      annotatorStatus: user.annotatorStatus,
      microTaskerStatus: user.microTaskerStatus,
      isEmailVerified: user.isEmailVerified,
      hasSetPassword: user.hasSetPassword,
      resultLink: user.resultLink,

      // Extended profile information in camelCase
      personalInfo: {
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phone,
        country: user.personal_info?.country || "",
        timeZone: user.personal_info?.time_zone || "",
        availableHoursPerWeek: user.personal_info?.available_hours_per_week || 0,
        preferredCommunicationChannel: user.personal_info?.preferred_communication_channel || ""
      },
      paymentInfo: {
        accountName: user.payment_info?.account_name || "",
        accountNumber: user.payment_info?.account_number || "",
        bankName: user.payment_info?.bank_name || "",
        paymentMethod: user.payment_info?.payment_method || "",
        paymentCurrency: user.payment_info?.payment_currency || ""
      },
      professionalBackground: {
        educationField: user.professional_background?.education_field || "",
        yearsOfExperience: user.professional_background?.years_of_experience || 0,
        annotationExperienceTypes: user.professional_background?.annotation_experience_types || []
      },
      toolExperience: user.tool_experience || [],
      annotationSkills: user.annotation_skills || [],
      languageProficiency: {
        primaryLanguage: user.language_proficiency?.primary_language || "",
        otherLanguages: user.language_proficiency?.other_languages || [],
        englishFluencyLevel: user.language_proficiency?.english_fluency_level || ""
      },
      systemInfo: {
        deviceType: user.system_info?.device_type || "",
        operatingSystem: user.system_info?.operating_system || "",
        internetSpeedMbps: user.system_info?.internet_speed_mbps || 0,
        powerBackup: user.system_info?.power_backup || false,
        hasWebcam: user.system_info?.has_webcam || false,
        hasMicrophone: user.system_info?.has_microphone || false
      },
      projectPreferences: {
        domainsOfInterest: user.project_preferences?.domains_of_interest || user.domains || [],
        availabilityType: user.project_preferences?.availability_type || "",
        ndaSigned: user.project_preferences?.nda_signed || false
      },
      attachments: {
        resumeUrl: user.attachments?.resume_url || "",
        idDocumentUrl: user.attachments?.id_document_url || "",
        workSamplesUrl: user.attachments?.work_samples_url || []
      },
      accountMetadata: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        status: user.annotatorStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword
      }
    };

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      profile: profileData
    });

  } catch (error) {
    console.error("❌ Error fetching DTUser profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: error.message,
    });
  }
};

// Update DTUser profile (PATCH endpoint)
const updateDTUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate input
    const { error } = dtUserProfileUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    console.log(`📝 Profile update request for user ID: ${userId}`);

    // Check if requesting user can update this profile (from auth middleware)
    if (req.user.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own profile.",
        code: 'ACCESS_DENIED'
      });
    }

    // Find the user
    const user = await DTUser.findById(userId);
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check if user is verified to make profile updates
    if (user.annotatorStatus !== 'verified' && user.annotatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: "Profile updates are only allowed for verified annotators",
        code: 'NOT_VERIFIED',
        currentStatus: user.annotatorStatus
      });
    }

    console.log(`✅ User ${user.email} is ${user.annotatorStatus}, proceeding with update`);
    console.log(`📊 Request body received:`, JSON.stringify(req.body, null, 2));

    // Prepare update object
    const updateData = {};
    
    // Update personal info
    if (req.body.personalInfo) {
      console.log(`🔄 Updating personal info...`);
      updateData.personal_info = {
        ...user.personal_info?.toObject(),
        country: req.body.personalInfo.country !== undefined ? req.body.personalInfo.country : user.personal_info?.country,
        time_zone: req.body.personalInfo.timeZone !== undefined ? req.body.personalInfo.timeZone : user.personal_info?.time_zone,
        available_hours_per_week: req.body.personalInfo.availableHoursPerWeek !== undefined ? req.body.personalInfo.availableHoursPerWeek : user.personal_info?.available_hours_per_week,
        preferred_communication_channel: req.body.personalInfo.preferredCommunicationChannel !== undefined ? req.body.personalInfo.preferredCommunicationChannel : user.personal_info?.preferred_communication_channel
      };
    }

    // Update payment info
    if (req.body.paymentInfo) {
      console.log(`💳 Updating payment info...`);
      console.log(`💳 Current payment_info:`, user.payment_info);
      console.log(`💳 Incoming paymentInfo:`, req.body.paymentInfo);
      
      updateData.payment_info = {
        ...user.payment_info?.toObject(),
        account_name: req.body.paymentInfo.accountName !== undefined ? req.body.paymentInfo.accountName : user.payment_info?.account_name,
        account_number: req.body.paymentInfo.accountNumber !== undefined ? req.body.paymentInfo.accountNumber : user.payment_info?.account_number,
        bank_name: req.body.paymentInfo.bankName !== undefined ? req.body.paymentInfo.bankName : user.payment_info?.bank_name,
        payment_method: req.body.paymentInfo.paymentMethod !== undefined ? req.body.paymentInfo.paymentMethod : user.payment_info?.payment_method,
        payment_currency: req.body.paymentInfo.paymentCurrency !== undefined ? req.body.paymentInfo.paymentCurrency : user.payment_info?.payment_currency
      };
      
      console.log(`💳 Prepared payment_info update:`, updateData.payment_info);
    }

    // Update professional background
    if (req.body.professionalBackground) {
      updateData.professional_background = {
        ...user.professional_background?.toObject(),
        education_field: req.body.professionalBackground.educationField !== undefined ? req.body.professionalBackground.educationField : user.professional_background?.education_field,
        years_of_experience: req.body.professionalBackground.yearsOfExperience !== undefined ? req.body.professionalBackground.yearsOfExperience : user.professional_background?.years_of_experience,
        annotation_experience_types: req.body.professionalBackground.annotationExperienceTypes !== undefined ? req.body.professionalBackground.annotationExperienceTypes : user.professional_background?.annotation_experience_types
      };
    }

    // Update tool experience
    if (req.body.toolExperience !== undefined) {
      updateData.tool_experience = req.body.toolExperience;
    }

    // Update annotation skills
    if (req.body.annotationSkills !== undefined) {
      updateData.annotation_skills = req.body.annotationSkills;
    }

    // Update language proficiency
    if (req.body.languageProficiency) {
      updateData.language_proficiency = {
        ...user.language_proficiency?.toObject(),
        primary_language: req.body.languageProficiency.primaryLanguage !== undefined ? req.body.languageProficiency.primaryLanguage : user.language_proficiency?.primary_language,
        other_languages: req.body.languageProficiency.otherLanguages !== undefined ? req.body.languageProficiency.otherLanguages : user.language_proficiency?.other_languages,
        english_fluency_level: req.body.languageProficiency.englishFluencyLevel !== undefined ? req.body.languageProficiency.englishFluencyLevel : user.language_proficiency?.english_fluency_level
      };
    }

    // Update system info
    if (req.body.systemInfo) {
      updateData.system_info = {
        ...user.system_info?.toObject(),
        device_type: req.body.systemInfo.deviceType !== undefined ? req.body.systemInfo.deviceType : user.system_info?.device_type,
        operating_system: req.body.systemInfo.operatingSystem !== undefined ? req.body.systemInfo.operatingSystem : user.system_info?.operating_system,
        internet_speed_mbps: req.body.systemInfo.internetSpeedMbps !== undefined ? req.body.systemInfo.internetSpeedMbps : user.system_info?.internet_speed_mbps,
        power_backup: req.body.systemInfo.powerBackup !== undefined ? req.body.systemInfo.powerBackup : user.system_info?.power_backup,
        has_webcam: req.body.systemInfo.hasWebcam !== undefined ? req.body.systemInfo.hasWebcam : user.system_info?.has_webcam,
        has_microphone: req.body.systemInfo.hasMicrophone !== undefined ? req.body.systemInfo.hasMicrophone : user.system_info?.has_microphone
      };
    }

    // Update project preferences
    if (req.body.projectPreferences) {
      updateData.project_preferences = {
        ...user.project_preferences?.toObject(),
        domains_of_interest: req.body.projectPreferences.domainsOfInterest !== undefined ? req.body.projectPreferences.domainsOfInterest : user.project_preferences?.domains_of_interest,
        availability_type: req.body.projectPreferences.availabilityType !== undefined ? req.body.projectPreferences.availabilityType : user.project_preferences?.availability_type,
        nda_signed: req.body.projectPreferences.ndaSigned !== undefined ? req.body.projectPreferences.ndaSigned : user.project_preferences?.nda_signed
      };
    }

    // Update attachments
    if (req.body.attachments) {
      updateData.attachments = {
        ...user.attachments?.toObject(),
        resume_url: req.body.attachments.resumeUrl !== undefined ? req.body.attachments.resumeUrl : user.attachments?.resume_url,
        id_document_url: req.body.attachments.idDocumentUrl !== undefined ? req.body.attachments.idDocumentUrl : user.attachments?.id_document_url,
        work_samples_url: req.body.attachments.workSamplesUrl !== undefined ? req.body.attachments.workSamplesUrl : user.attachments?.work_samples_url
      };
    }

    console.log(`🔄 Final updateData being sent to MongoDB:`, JSON.stringify(updateData, null, 2));

    // Perform the update
    const updatedUser = await DTUser.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(`✅ Profile updated successfully for user: ${user.email}`);
    console.log(`💳 Final payment_info in database:`, updatedUser.payment_info);

    // Return updated profile in the same format as getDTUserProfile
    const profileData = {
      id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      domains: updatedUser.domains,
      consent: updatedUser.consent,
      annotatorStatus: updatedUser.annotatorStatus,
      microTaskerStatus: updatedUser.microTaskerStatus,
      isEmailVerified: updatedUser.isEmailVerified,
      hasSetPassword: updatedUser.hasSetPassword,
      resultLink: updatedUser.resultLink,

      personalInfo: {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phoneNumber: updatedUser.phone,
        country: updatedUser.personal_info?.country || "",
        timeZone: updatedUser.personal_info?.time_zone || "",
        availableHoursPerWeek: updatedUser.personal_info?.available_hours_per_week || 0,
        preferredCommunicationChannel: updatedUser.personal_info?.preferred_communication_channel || ""
      },
      paymentInfo: {
        accountName: updatedUser.payment_info?.account_name || "",
        accountNumber: updatedUser.payment_info?.account_number || "",
        bankName: updatedUser.payment_info?.bank_name || "",
        paymentMethod: updatedUser.payment_info?.payment_method || "",
        paymentCurrency: updatedUser.payment_info?.payment_currency || ""
      },
      professionalBackground: {
        educationField: updatedUser.professional_background?.education_field || "",
        yearsOfExperience: updatedUser.professional_background?.years_of_experience || 0,
        annotationExperienceTypes: updatedUser.professional_background?.annotation_experience_types || []
      },
      toolExperience: updatedUser.tool_experience || [],
      annotationSkills: updatedUser.annotation_skills || [],
      languageProficiency: {
        primaryLanguage: updatedUser.language_proficiency?.primary_language || "",
        otherLanguages: updatedUser.language_proficiency?.other_languages || [],
        englishFluencyLevel: updatedUser.language_proficiency?.english_fluency_level || ""
      },
      systemInfo: {
        deviceType: updatedUser.system_info?.device_type || "",
        operatingSystem: updatedUser.system_info?.operating_system || "",
        internetSpeedMbps: updatedUser.system_info?.internet_speed_mbps || 0,
        powerBackup: updatedUser.system_info?.power_backup || false,
        hasWebcam: updatedUser.system_info?.has_webcam || false,
        hasMicrophone: updatedUser.system_info?.has_microphone || false
      },
      projectPreferences: {
        domainsOfInterest: updatedUser.project_preferences?.domains_of_interest || updatedUser.domains || [],
        availabilityType: updatedUser.project_preferences?.availability_type || "",
        ndaSigned: updatedUser.project_preferences?.nda_signed || false
      },
      attachments: {
        resumeUrl: updatedUser.attachments?.resume_url || "",
        idDocumentUrl: updatedUser.attachments?.id_document_url || "",
        workSamplesUrl: updatedUser.attachments?.work_samples_url || []
      },
      accountMetadata: {
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        status: updatedUser.annotatorStatus,
        isEmailVerified: updatedUser.isEmailVerified,
        hasSetPassword: updatedUser.hasSetPassword
      }
    };

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: profileData,
      fieldsUpdated: Object.keys(req.body)
    });

  } catch (error) {
    console.error("❌ Error updating DTUser profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: error.message,
    });
  }
};

// DTUser password reset function (requires old password)
const resetDTUserPassword = async (req, res) => {
  try {
    // Validate input
    const { error } = dtUserPasswordResetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId; // From JWT token via authenticateToken middleware

    console.log(`🔐 Password reset request for user ID: ${userId}`);

    // Find user by ID
    const user = await DTUser.findById(userId);
    
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check if user has a password set
    if (!user.hasSetPassword || !user.password) {
      console.log(`❌ User ${user.email} does not have a password set`);
      return res.status(400).json({ 
        success: false,
        message: "No password is currently set. Please use the setup password endpoint instead.",
        requiresPasswordSetup: true
      });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      console.log(`❌ Invalid old password for user: ${user.email}`);
      return res.status(400).json({ 
        success: false,
        message: "Current password is incorrect" 
      });
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      console.log(`❌ New password same as old password for user: ${user.email}`);
      return res.status(400).json({ 
        success: false,
        message: "New password must be different from current password" 
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    user.password = hashedNewPassword;
    await user.save();

    console.log(`✅ Password successfully reset for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        hasSetPassword: true,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error resetting DTUser password:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password reset",
      error: error.message,
    });
  }
};

// Get single DTUser (public endpoint)
const getDTUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`👤 Fetching DTUser details for ID: ${id}`);

    const user = await DTUser.findById(id).select('-password'); // Exclude password for security
    
    if (!user) {
      console.log(`❌ User not found with ID: ${id}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    console.log(`✅ Retrieved DTUser details for: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        domains: user.domains,
        consent: user.consent,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        resultLink: user.resultLink,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Error fetching DTUser details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user details",
      error: error.message,
    });
  }
};

// Admin function: Get all DTUsers
const getAllDTUsers = async (req, res) => {
  try {
    console.log(`👥 Admin ${req.admin.email} requesting all DTUsers`);

    // Query parameters for filtering and pagination
    const { 
      page = 1, 
      limit = 20, 
      status,
      verified,
      hasPassword,
      search 
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Exclude admin users (those with admin email domains or admin-related domains)
    filter.$and = [
      { 
        $nor: [
          { email: { $regex: /@mydeeptech\.ng$/, $options: 'i' } }, // Exclude @mydeeptech.ng emails
          { domains: { $in: ['Administration', 'Management'] } } // Exclude admin domains
        ]
      }
    ];
    
    if (status) {
      filter.annotatorStatus = status;
    }
    
    if (verified !== undefined) {
      filter.isEmailVerified = verified === 'true';
    }
    
    if (hasPassword !== undefined) {
      filter.hasSetPassword = hasPassword === 'true';
    }
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users with pagination
    const users = await DTUser.find(filter)
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalUsers = await DTUser.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    // Get status summary (excluding admin users)
    const statusSummary = await DTUser.aggregate([
      { 
        $match: {
          $nor: [
            { email: { $regex: /@mydeeptech\.ng$/, $options: 'i' } }, // Exclude @mydeeptech.ng emails
            { domains: { $in: ['Administration', 'Management'] } } // Exclude admin domains
          ]
        }
      },
      { $group: { _id: '$annotatorStatus', count: { $sum: 1 } } }
    ]);

    console.log(`✅ Retrieved ${users.length} DTUsers (Page ${page}/${totalPages})`);

    res.status(200).json({
      success: true,
      message: "DTUsers retrieved successfully",
      data: {
        users: users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalUsers: totalUsers,
          usersPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPreviousPage: parseInt(page) > 1
        },
        summary: {
          totalUsers: totalUsers,
          statusBreakdown: statusSummary.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          filters: filter
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching all DTUsers:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching DTUsers",
      error: error.message,
    });
  }
};

// Admin function: Get all admin users
const getAllAdminUsers = async (req, res) => {
  try {
    console.log(`🔍 Admin ${req.admin.email} requesting admin users list`);

    // Build filter for admin users only
    const filter = {
      $or: [
        { email: /@mydeeptech\.ng$/i }, // Users with @mydeeptech.ng emails
        { domains: { $in: ['Administration', 'Management'] } } // Users with admin domains
      ]
    };

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search;

    // Add search functionality if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      });
    }

    console.log('🔍 Admin users filter:', JSON.stringify(filter, null, 2));

    // Get admin users with pagination
    const adminUsers = await DTUser.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-password') // Exclude password field
      .lean();

    // Get total count for pagination
    const totalAdminUsers = await DTUser.countDocuments(filter);

    console.log(`✅ Found ${adminUsers.length} admin users (${totalAdminUsers} total)`);

    // Get role/status summary for admin users
    const roleSummary = await DTUser.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            hasAdminDomains: {
              $cond: {
                if: { $setIsSubset: [['Administration', 'Management'], { $ifNull: ['$domains', []] }] },
                then: true,
                else: false
              }
            },
            emailDomain: { $substr: ['$email', { $indexOfCP: ['$email', '@'] }, -1] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalAdminUsers / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      message: `Retrieved ${adminUsers.length} admin users`,
      data: {
        adminUsers: adminUsers,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalAdminUsers: totalAdminUsers,
          hasNextPage: hasNextPage,
          hasPrevPage: hasPrevPage,
          limit: limit
        },
        summary: {
          totalAdminUsers: totalAdminUsers,
          roleSummary: roleSummary,
          filters: filter
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching admin users:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching admin users",
      error: error.message,
    });
  }
};

// Admin function: Get comprehensive admin dashboard overview
const getAdminDashboard = async (req, res) => {
  try {
    console.log(`📊 Admin ${req.admin.email} requesting dashboard overview`);

    // Get current date for time-based filtering
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(currentDate.getDate() - 30);
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7);

    // ===== DTUSER STATISTICS =====
    const dtUserStats = await DTUser.aggregate([
      {
        $match: {
          $nor: [
            { email: /@mydeeptech\.ng$/i },
            { domains: { $in: ['Administration', 'Management'] } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          pendingAnnotators: { 
            $sum: { $cond: [{ $eq: ['$annotatorStatus', 'pending'] }, 1, 0] }
          },
          submittedAnnotators: { 
            $sum: { $cond: [{ $eq: ['$annotatorStatus', 'submitted'] }, 1, 0] }
          },
          verifiedAnnotators: { 
            $sum: { $cond: [{ $eq: ['$annotatorStatus', 'verified'] }, 1, 0] }
          },
          approvedAnnotators: { 
            $sum: { $cond: [{ $eq: ['$annotatorStatus', 'approved'] }, 1, 0] }
          },
          rejectedAnnotators: { 
            $sum: { $cond: [{ $eq: ['$annotatorStatus', 'rejected'] }, 1, 0] }
          },
          pendingMicroTaskers: { 
            $sum: { $cond: [{ $eq: ['$microTaskerStatus', 'pending'] }, 1, 0] }
          },
          approvedMicroTaskers: { 
            $sum: { $cond: [{ $eq: ['$microTaskerStatus', 'approved'] }, 1, 0] }
          },
          verifiedEmails: { 
            $sum: { $cond: ['$isEmailVerified', 1, 0] }
          },
          usersWithPasswords: { 
            $sum: { $cond: ['$hasSetPassword', 1, 0] }
          },
          usersWithResults: { 
            $sum: { $cond: [{ $ne: ['$resultLink', ''] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent DTUser registrations (last 30 days)
    const recentRegistrations = await DTUser.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          $nor: [
            { email: /@mydeeptech\.ng$/i },
            { domains: { $in: ['Administration', 'Management'] } }
          ]
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // ===== PROJECT STATISTICS =====
    const projectStats = await AnnotationProject.aggregate([
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          activeProjects: { 
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedProjects: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pausedProjects: { 
            $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] }
          },
          totalBudget: { $sum: '$budget' },
          totalSpent: { $sum: '$spentBudget' }
        }
      }
    ]);

    // ===== APPLICATION STATISTICS =====
    const applicationStats = await ProjectApplication.aggregate([
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          pendingApplications: { 
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approvedApplications: { 
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedApplications: { 
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    // ===== INVOICE STATISTICS =====
    const invoiceStats = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$invoiceAmount' },
          paidAmount: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] }
          },
          unpaidAmount: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$invoiceAmount', 0] }
          },
          overdueAmount: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, '$invoiceAmount', 0] }
          },
          paidCount: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          unpaidCount: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
          },
          overdueCount: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent invoice activities (last 7 days)
    const recentInvoiceActivity = await Invoice.aggregate([
      {
        $match: {
          $or: [
            { createdAt: { $gte: sevenDaysAgo } },
            { paidAt: { $gte: sevenDaysAgo } }
          ]
        }
      },
      {
        $group: {
          _id: {
            year: { $year: { $ifNull: ['$paidAt', '$createdAt'] } },
            month: { $month: { $ifNull: ['$paidAt', '$createdAt'] } },
            day: { $dayOfMonth: { $ifNull: ['$paidAt', '$createdAt'] } }
          },
          invoicesCreated: { 
            $sum: { $cond: [{ $gte: ['$createdAt', sevenDaysAgo] }, 1, 0] }
          },
          invoicesPaid: { 
            $sum: { $cond: [{ $and: [{ $gte: ['$paidAt', sevenDaysAgo] }, { $ne: ['$paidAt', null] }] }, 1, 0] }
          },
          amountPaid: { 
            $sum: { $cond: [{ $and: [{ $gte: ['$paidAt', sevenDaysAgo] }, { $ne: ['$paidAt', null] }] }, '$invoiceAmount', 0] }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // ===== TOP PERFORMING ANNOTATORS =====
    const topAnnotators = await DTUser.aggregate([
      {
        $match: {
          annotatorStatus: 'approved',
          resultSubmissions: { $exists: true, $ne: [] }
        }
      },
      {
        $project: {
          fullName: 1,
          email: 1,
          submissionCount: { $size: '$resultSubmissions' },
          lastSubmission: { $max: '$resultSubmissions.submissionDate' }
        }
      },
      {
        $sort: { submissionCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // ===== RECENT ACTIVITIES =====
    const recentUsers = await DTUser.find({
      $nor: [
        { email: /@mydeeptech\.ng$/i },
        { domains: { $in: ['Administration', 'Management'] } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('fullName email annotatorStatus microTaskerStatus createdAt isEmailVerified');

    const recentProjects = await AnnotationProject.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('projectName status budget spentBudget createdAt');

    // ===== DOMAIN STATISTICS =====
    const domainStats = await DTUser.aggregate([
      {
        $match: {
          $nor: [
            { email: /@mydeeptech\.ng$/i },
            { domains: { $in: ['Administration', 'Management'] } }
          ]
        }
      },
      { $unwind: '$domains' },
      {
        $group: {
          _id: '$domains',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Prepare response
    const dashboardData = {
      overview: {
        totalUsers: dtUserStats[0]?.totalUsers || 0,
        totalProjects: projectStats[0]?.totalProjects || 0,
        totalInvoices: invoiceStats[0]?.totalInvoices || 0,
        totalRevenue: invoiceStats[0]?.paidAmount || 0,
        pendingApplications: applicationStats[0]?.pendingApplications || 0
      },
      dtUserStatistics: dtUserStats[0] || {
        totalUsers: 0,
        pendingAnnotators: 0,
        submittedAnnotators: 0,
        verifiedAnnotators: 0,
        approvedAnnotators: 0,
        rejectedAnnotators: 0,
        pendingMicroTaskers: 0,
        approvedMicroTaskers: 0,
        verifiedEmails: 0,
        usersWithPasswords: 0,
        usersWithResults: 0
      },
      projectStatistics: projectStats[0] || {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        pausedProjects: 0,
        totalBudget: 0,
        totalSpent: 0
      },
      applicationStatistics: applicationStats[0] || {
        totalApplications: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0
      },
      invoiceStatistics: invoiceStats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        overdueAmount: 0,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0
      },
      trends: {
        recentRegistrations,
        recentInvoiceActivity
      },
      topPerformers: {
        topAnnotators
      },
      recentActivities: {
        recentUsers,
        recentProjects
      },
      insights: {
        domainDistribution: domainStats,
        conversionRates: {
          emailVerificationRate: dtUserStats[0]?.totalUsers ? 
            ((dtUserStats[0]?.verifiedEmails || 0) / dtUserStats[0].totalUsers * 100).toFixed(1) : '0',
          passwordSetupRate: dtUserStats[0]?.totalUsers ? 
            ((dtUserStats[0]?.usersWithPasswords || 0) / dtUserStats[0].totalUsers * 100).toFixed(1) : '0',
          resultSubmissionRate: dtUserStats[0]?.totalUsers ? 
            ((dtUserStats[0]?.usersWithResults || 0) / dtUserStats[0].totalUsers * 100).toFixed(1) : '0',
          approvalRate: (dtUserStats[0]?.pendingAnnotators || 0) + (dtUserStats[0]?.submittedAnnotators || 0) + (dtUserStats[0]?.verifiedAnnotators || 0) + (dtUserStats[0]?.approvedAnnotators || 0) + (dtUserStats[0]?.rejectedAnnotators || 0) > 0 ?
            ((dtUserStats[0]?.approvedAnnotators || 0) / ((dtUserStats[0]?.pendingAnnotators || 0) + (dtUserStats[0]?.submittedAnnotators || 0) + (dtUserStats[0]?.verifiedAnnotators || 0) + (dtUserStats[0]?.approvedAnnotators || 0) + (dtUserStats[0]?.rejectedAnnotators || 0)) * 100).toFixed(1) : '0'
        },
        financialHealth: {
          paymentRate: invoiceStats[0]?.totalInvoices ? 
            ((invoiceStats[0]?.paidCount || 0) / invoiceStats[0].totalInvoices * 100).toFixed(1) : '0',
          averageInvoiceAmount: invoiceStats[0]?.totalInvoices ? 
            (invoiceStats[0]?.totalAmount / invoiceStats[0].totalInvoices).toFixed(2) : '0',
          outstandingBalance: (invoiceStats[0]?.unpaidAmount || 0) + (invoiceStats[0]?.overdueAmount || 0)
        }
      },
      generatedAt: new Date(),
      timeframe: {
        registrationData: '30 days',
        invoiceActivity: '7 days'
      }
    };

    console.log(`📊 Dashboard data generated for admin: ${req.admin.email}`);

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error("❌ Error generating admin dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating admin dashboard",
      error: error.message
    });
  }
};

// Admin function: Approve annotator
const approveAnnotator = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newStatus = 'approved' } = req.body;

    console.log(`✅ Admin ${req.admin.email} attempting to approve annotator: ${userId} with status: ${newStatus}`);

    // Validate new status
    const validStatuses = ['pending', 'submitted', 'verified', 'approved', 'rejected'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        validStatuses: validStatuses
      });
    }

    // Find the user
    const user = await DTUser.findById(userId);
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const previousStatus = user.annotatorStatus;
    
    // Update the statuses based on approval/rejection
    if (newStatus === 'approved') {
      // Approved annotator: both statuses set to approved
      user.annotatorStatus = 'approved';
      user.microTaskerStatus = 'approved';
      
      console.log(`✅ Setting ${user.email} as approved annotator (both statuses approved)`);
      
    } else if (newStatus === 'rejected') {
      // Rejected annotator: annotator rejected but micro tasker approved
      user.annotatorStatus = 'rejected';
      user.microTaskerStatus = 'approved';
      
      console.log(`❌ Setting ${user.email} as rejected annotator but approved micro tasker`);
      
    } else {
      // Other statuses: only update annotator status
      user.annotatorStatus = newStatus;
      
      console.log(`🔄 Setting ${user.email} annotator status to: ${newStatus}`);
    }

    await user.save();

    console.log(`✅ Successfully updated ${user.email} from ${previousStatus} to ${newStatus}`);

    // Send appropriate email notification
    try {
      if (newStatus === 'approved') {
        // Send annotator approval email
        await sendAnnotatorApprovalEmail(user.email, user.fullName);
        console.log(`📧 Annotator approval email sent to: ${user.email}`);
        
      } else if (newStatus === 'rejected') {
        // Send micro tasker approval email (rejection from annotator but approval for micro tasks)
        await sendAnnotatorRejectionEmail(user.email, user.fullName);
        console.log(`📧 Micro tasker approval email sent to: ${user.email}`);
      }
    } catch (emailError) {
      console.error(`❌ Failed to send notification email to ${user.email}:`, emailError);
      // Don't fail the status update if email fails, but log it
    }

    // Return updated user info
    res.status(200).json({
      success: true,
      message: `Annotator status updated successfully from ${previousStatus} to ${newStatus}`,
      data: {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        previousStatus: previousStatus,
        newStatus: newStatus,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        emailNotificationSent: newStatus === 'approved' || newStatus === 'rejected',
        updatedAt: user.updatedAt,
        updatedBy: req.admin.email
      }
    });

  } catch (error) {
    console.error("❌ Error approving annotator:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating annotator status",
      error: error.message,
    });
  }
};

// Admin function: Reject annotator (dedicated endpoint)
const rejectAnnotator = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = '' } = req.body; // Optional rejection reason

    console.log(`❌ Admin ${req.admin.email} rejecting annotator: ${userId} ${reason ? 'with reason: ' + reason : ''}`);

    // Find the user
    const user = await DTUser.findById(userId);
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const previousStatus = user.annotatorStatus;
    
    // Reject annotator: annotator rejected but micro tasker approved
    user.annotatorStatus = 'rejected';
    user.microTaskerStatus = 'approved';

    await user.save();

    console.log(`❌ ${user.email} annotator rejected, micro tasker approved`);
    console.log(`📊 Status change: ${previousStatus} → rejected (annotator), approved (micro tasker)`);

    // Send micro tasker approval email (soft rejection - they can still do micro tasks)
    try {
      const { sendAnnotatorRejectionEmail } = require('../utils/annotatorMailer');
      await sendAnnotatorRejectionEmail(user.email, user.fullName);
      console.log(`📧 Micro tasker approval email sent to: ${user.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send notification email to ${user.email}:`, emailError);
      // Don't fail the status update if email fails, but log it
    }

    // Return updated user info
    res.status(200).json({
      success: true,
      message: `Annotator rejected successfully. User approved as micro tasker.`,
      data: {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        previousStatus: previousStatus,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        reason: reason || 'No reason provided',
        emailNotificationSent: true,
        updatedAt: user.updatedAt,
        rejectedBy: req.admin.email
      }
    });

  } catch (error) {
    console.error("❌ Error rejecting annotator:", error);
    res.status(500).json({
      success: false,
      message: "Server error rejecting annotator",
      error: error.message,
    });
  }
};

// Admin function: Get single DTUser details
const getDTUserAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Admin ${req.admin.email} requesting details for user: ${userId}`);

    const user = await DTUser.findById(userId).select('-password');
    
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    console.log(`✅ Retrieved user details for: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      data: {
        user: user
      }
    });

  } catch (error) {
    console.error("❌ Error fetching DTUser details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user details",
      error: error.message,
    });
  }
};

// Admin function: Request admin verification (Step 1)
const requestAdminVerification = async (req, res) => {
  try {
    // Validate input
    const { error } = adminVerificationRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { fullName, email, phone, password, adminKey } = req.body;

    console.log(`📧 Admin verification request for: ${email}`);

    // Verify admin creation key
    const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
    if (adminKey !== validAdminKey) {
      console.log(`❌ Invalid admin creation key provided`);
      return res.status(403).json({
        success: false,
        message: "Invalid admin creation key",
        code: 'INVALID_ADMIN_KEY'
      });
    }

    // Check if admin email is valid
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
    const isValidAdminEmail = email.toLowerCase().endsWith('@mydeeptech.ng') || adminEmails.includes(email.toLowerCase());
    
    if (!isValidAdminEmail) {
      console.log(`❌ Invalid admin email domain: ${email}`);
      return res.status(400).json({
        success: false,
        message: "Admin email must end with @mydeeptech.ng or be in approved admin list",
        code: 'INVALID_ADMIN_EMAIL'
      });
    }

    // Check if admin already exists
    const existingAdmin = await DTUser.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.log(`❌ Admin already exists: ${email}`);
      return res.status(409).json({
        success: false,
        message: "Admin account already exists with this email",
        code: 'ADMIN_EXISTS'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store admin data temporarily with verification code
    const adminData = { fullName, email, phone, password };
    adminVerificationStore.setVerificationCode(email, verificationCode, adminData);

    // Send verification email
    try {
      await sendAdminVerificationEmail(email, verificationCode, fullName);
      
      console.log(`✅ Admin verification email sent to: ${email}`);

      res.status(200).json({
        success: true,
        message: "Verification code sent to admin email",
        data: {
          email: email,
          expiresIn: "15 minutes",
          nextStep: "Use the verification code from your email to complete admin account creation"
        }
      });

    } catch (emailError) {
      console.error(`❌ Failed to send verification email:`, emailError);
      
      // Clean up stored verification data if email fails
      adminVerificationStore.removeVerificationCode(email);
      
      res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
        error: emailError.message
      });
    }

  } catch (error) {
    console.error("❌ Error requesting admin verification:", error);
    res.status(500).json({
      success: false,
      message: "Server error requesting admin verification",
      error: error.message,
    });
  }
};

// Admin function: Confirm verification and create admin (Step 2)
const confirmAdminVerification = async (req, res) => {
  try {
    // Validate input
    const { error } = adminVerificationConfirmSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email, verificationCode, adminKey } = req.body;

    console.log(`✅ Admin verification confirmation for: ${email}`);

    // Verify admin creation key again
    const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
    if (adminKey !== validAdminKey) {
      console.log(`❌ Invalid admin creation key provided`);
      return res.status(403).json({
        success: false,
        message: "Invalid admin creation key",
        code: 'INVALID_ADMIN_KEY'
      });
    }

    // Get verification data
    const verificationData = adminVerificationStore.getVerificationData(email);
    if (!verificationData) {
      console.log(`❌ No verification request found for: ${email}`);
      return res.status(404).json({
        success: false,
        message: "No verification request found or verification expired",
        code: 'VERIFICATION_NOT_FOUND'
      });
    }

    // Check if verification code has expired
    if (Date.now() > verificationData.expiresAt) {
      console.log(`❌ Verification code expired for: ${email}`);
      adminVerificationStore.removeVerificationCode(email);
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
        code: 'VERIFICATION_EXPIRED'
      });
    }

    // Check verification attempts
    if (verificationData.attempts >= 3) {
      console.log(`❌ Too many verification attempts for: ${email}`);
      adminVerificationStore.removeVerificationCode(email);
      return res.status(429).json({
        success: false,
        message: "Too many verification attempts. Please request a new verification code.",
        code: 'TOO_MANY_ATTEMPTS'
      });
    }

    // Verify the code
    if (verificationCode !== verificationData.code) {
      console.log(`❌ Invalid verification code for: ${email}`);
      const attempts = adminVerificationStore.incrementAttempts(email);
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
        code: 'INVALID_VERIFICATION_CODE',
        attemptsRemaining: 3 - attempts
      });
    }

    // Verification successful - create admin account
    const { fullName, phone, password } = verificationData.adminData;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user (with unverified email - they need to verify via email link)
    const newAdmin = new DTUser({
      fullName,
      phone,
      email: email.toLowerCase(),
      domains: ['Administration', 'Management'],
      socialsFollowed: [],
      consent: true,
      password: hashedPassword,
      hasSetPassword: true,
      isEmailVerified: false, // Requires email verification via link
      annotatorStatus: 'approved', // Admins are pre-approved
      microTaskerStatus: 'approved',
      resultLink: ''
    });

    await newAdmin.save();

    // Generate and send OTP code for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    
    // Store OTP in Redis with user data
    try {
      await adminVerificationStore.setVerificationCode(newAdmin.email, otpCode, {
        userId: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        purpose: 'email_verification'
      });
      
      // Send OTP email using admin mailer
      await sendAdminVerificationEmail(newAdmin.email, otpCode, newAdmin.fullName);
      console.log(`✅ OTP code sent to admin email: ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send OTP to admin: ${email}`, emailError);
      // Don't fail the admin creation if email fails, but log it
    }

    // Clean up verification data
    adminVerificationStore.removeVerificationCode(email);

    console.log(`✅ Admin account created successfully: ${email}`);

    // Return admin data (note: no token provided since email needs OTP verification)
    res.status(201).json({
      success: true,
      message: "Admin account created successfully! Please check your email for the OTP code to verify your account.",
      otpVerificationRequired: true,
      admin: {
        id: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        phone: newAdmin.phone,
        domains: newAdmin.domains,
        isEmailVerified: newAdmin.isEmailVerified,
        hasSetPassword: newAdmin.hasSetPassword,
        annotatorStatus: newAdmin.annotatorStatus,
        microTaskerStatus: newAdmin.microTaskerStatus,
        createdAt: newAdmin.createdAt,
        isAdmin: true
      }
    });

  } catch (error) {
    console.error("❌ Error confirming admin verification:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating admin account",
      error: error.message,
    });
  }
};

// Legacy admin creation function (kept for backward compatibility)
const createAdmin = async (req, res) => {
  try {
    // Validate input
    const { error } = adminCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { fullName, email, phone, password, adminKey } = req.body;

    console.log(`👑 Direct admin creation request for: ${email} (legacy method)`);

    // Verify admin creation key
    const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
    if (adminKey !== validAdminKey) {
      console.log(`❌ Invalid admin creation key provided`);
      return res.status(403).json({
        success: false,
        message: "Invalid admin creation key",
        code: 'INVALID_ADMIN_KEY'
      });
    }

    // Check if admin email is valid (must end with @mydeeptech.ng or be in admin emails)
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
    const isValidAdminEmail = email.toLowerCase().endsWith('@mydeeptech.ng') || adminEmails.includes(email.toLowerCase());
    
    if (!isValidAdminEmail) {
      console.log(`❌ Invalid admin email domain: ${email}`);
      return res.status(400).json({
        success: false,
        message: "Admin email must end with @mydeeptech.ng or be in approved admin list",
        code: 'INVALID_ADMIN_EMAIL'
      });
    }

    // Check if admin already exists
    const existingAdmin = await DTUser.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.log(`❌ Admin already exists: ${email}`);
      return res.status(409).json({
        success: false,
        message: "Admin account already exists with this email",
        code: 'ADMIN_EXISTS'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user (with unverified email - they need to verify via email link)
    const newAdmin = new DTUser({
      fullName,
      phone,
      email: email.toLowerCase(),
      domains: ['Administration', 'Management'], // Default admin domains
      socialsFollowed: [],
      consent: true,
      password: hashedPassword,
      hasSetPassword: true,
      isEmailVerified: false, // Requires email verification via link
      annotatorStatus: 'approved', // Admins are pre-approved
      microTaskerStatus: 'approved',
      resultLink: ''
    });

    await newAdmin.save();

    // Generate and send OTP code for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    
    // Store OTP in Redis with user data
    try {
      await adminVerificationStore.setVerificationCode(newAdmin.email, otpCode, {
        userId: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        purpose: 'email_verification'
      });
      
      // Send OTP email using admin mailer
      await sendAdminVerificationEmail(newAdmin.email, otpCode, newAdmin.fullName);
      console.log(`✅ OTP code sent to admin email: ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send OTP to admin: ${email}`, emailError);
      // Don't fail the admin creation if email fails, but log it
    }

    console.log(`✅ Admin account created successfully: ${email}`);

    // Return admin data (note: no token provided since email needs OTP verification)  
    res.status(201).json({
      success: true,
      message: "Admin account created successfully! Please check your email for the OTP code to verify your account.",
      otpVerificationRequired: true,
      admin: {
        id: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        phone: newAdmin.phone,
        domains: newAdmin.domains,
        isEmailVerified: newAdmin.isEmailVerified,
        hasSetPassword: newAdmin.hasSetPassword,
        annotatorStatus: newAdmin.annotatorStatus,
        microTaskerStatus: newAdmin.microTaskerStatus,
        createdAt: newAdmin.createdAt,
        isAdmin: true
      }
    });

  } catch (error) {
    console.error("❌ Error creating admin account:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating admin account",
      error: error.message,
    });
  }
};

// Verify Admin Account with OTP
const verifyAdminOTP = async (req, res) => {
  try {
    console.log("🔐 Admin OTP verification attempt");

    // Validate request data
    const { error } = adminVerificationConfirmSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, verificationCode, adminKey } = req.body;

    // Verify admin creation key
    const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
    if (adminKey !== validAdminKey) {
      return res.status(403).json({
        success: false,
        message: "Invalid admin creation key",
        code: 'INVALID_ADMIN_KEY'
      });
    }

    // Get OTP verification data from Redis
    const verificationData = await adminVerificationStore.getVerificationData(email);
    if (!verificationData) {
      return res.status(404).json({
        success: false,
        message: "No OTP verification request found or OTP expired",
        code: 'OTP_NOT_FOUND'
      });
    }

    // Check if OTP has expired
    if (Date.now() > verificationData.expiresAt) {
      await adminVerificationStore.removeVerificationCode(email);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        code: 'OTP_EXPIRED'
      });
    }

    // Verify the OTP code
    if (verificationCode !== verificationData.code) {
      const attempts = await adminVerificationStore.incrementAttempts(email);
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
        code: 'INVALID_OTP',
        attemptsRemaining: 3 - attempts
      });
    }

    // OTP is valid - verify the admin's email
    const admin = await DTUser.findById(verificationData.adminData.userId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found",
        code: 'ADMIN_NOT_FOUND'
      });
    }

    // Update admin to verified status
    admin.isEmailVerified = true;
    await admin.save();

    // Clean up OTP data
    await adminVerificationStore.removeVerificationCode(email);

    // Generate JWT token for login
    const token = jwt.sign(
      { 
        userId: admin._id, 
        email: admin.email,
        isAdmin: true,
        role: admin.role || 'admin'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log(`✅ Admin account verified successfully: ${email}`);

    res.status(200).json({
      success: true,
      message: "Admin account verified successfully! You are now logged in.",
      _usrinfo: {
        data: token
      },
      token: token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        domains: admin.domains,
        isEmailVerified: admin.isEmailVerified,
        hasSetPassword: admin.hasSetPassword,
        annotatorStatus: admin.annotatorStatus,
        microTaskerStatus: admin.microTaskerStatus,
        createdAt: admin.createdAt,
        isAdmin: true
      }
    });

  } catch (error) {
    console.error("❌ Error during admin OTP verification:", error);
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
      error: error.message,
    });
  }
};

// Admin Login
const adminLogin = async (req, res) => {
  try {
    console.log("🔐 Admin login attempt for:", req.body.email);

    // 1️⃣ Validate request data
    const { error } = dtUserLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, password } = req.body;

    // 2️⃣ Find admin by email with @mydeeptech.ng domain
    if (!email.endsWith('@mydeeptech.ng')) {
      return res.status(400).json({
        success: false,
        message: "Admin login is restricted to @mydeeptech.ng domain"
      });
    }

    const admin = await DTUser.findOne({ 
      email: email.toLowerCase(),
      isEmailVerified: true,
      hasSetPassword: true
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or account not verified"
      });
    }

    // 3️⃣ Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // 4️⃣ Generate JWT token
    const token = jwt.sign(
      { 
        userId: admin._id, 
        email: admin.email,
        isAdmin: true,
        role: admin.role || 'admin'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log("✅ Admin login successful for:", email);

    // 5️⃣ Return success response
    res.status(200).json({
      success: true,
      message: "Admin login successful",
      _usrinfo: {
        data: token
      },
      token: token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        domains: admin.domains,
        isEmailVerified: admin.isEmailVerified,
        hasSetPassword: admin.hasSetPassword,
        annotatorStatus: admin.annotatorStatus,
        microTaskerStatus: admin.microTaskerStatus,
        createdAt: admin.createdAt,
        isAdmin: true,
        role: admin.role || 'admin'
      }
    });

  } catch (error) {
    console.error("❌ Error during admin login:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin login",
      error: error.message,
    });
  }
};

// Resend verification email endpoint
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    console.log(`📧 Resend verification email request for: ${email}`);

    // Find user by email
    const user = await DTUser.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    // Send verification email with timeout
    try {
      const emailPromise = Promise.race([
        sendVerificationEmail(user.email, user.fullName, user._id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email sending timeout')), 15000)
        )
      ]);
      
      await emailPromise;
      console.log(`✅ Verification email resent successfully to: ${email}`);
      
      res.status(200).json({
        success: true,
        message: "Verification email sent successfully. Please check your inbox.",
        emailSent: true
      });
      
    } catch (emailError) {
      console.error(`❌ Failed to resend verification email to ${email}:`, emailError.message);
      
      res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again later.",
        emailSent: false,
        error: emailError.message
      });
    }

  } catch (error) {
    console.error("❌ Error in resendVerificationEmail:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending verification email",
      error: error.message
    });
  }
};

// DTUser function: Get available projects (only for approved annotators)
const getAvailableProjects = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`🔍 User ${req.user.email} requesting available projects`);
    console.log(`📋 User data from middleware:`, {
      userId: req.user.userId,
      email: req.user.email,
      fullName: req.user.fullName,
      userDocStatus: req.user.userDoc?.annotatorStatus
    });

    // Get fresh user data to ensure we have the latest status
    const user = await DTUser.findById(userId);
    if (!user) {
      console.log(`❌ User ${req.user.email} not found in database`);
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    console.log(`📋 Fresh user data from DB:`, {
      userId: user._id,
      email: user.email,
      annotatorStatus: user.annotatorStatus,
      isEmailVerified: user.isEmailVerified
    });

    if (user.annotatorStatus !== 'approved') {
      console.log(`❌ User ${req.user.email} access denied - Status: ${user.annotatorStatus}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Only approved annotators can view projects."
      });
    }

    console.log(`✅ User ${req.user.email} approved - Status: ${user.annotatorStatus}`);

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;
    const minPayRate = req.query.minPayRate;
    const maxPayRate = req.query.maxPayRate;
    const difficultyLevel = req.query.difficultyLevel;
    const view = req.query.view || 'available'; // 'available', 'applied', 'all'
    const applicationStatus = req.query.status; // 'pending', 'approved', 'rejected'

    console.log(`🔍 Projects view requested: ${view}, status filter: ${applicationStatus || 'none'}`);

    // Build base filter for projects
    const filter = {
      status: 'active',
      isPublic: true
    };

    // Only apply application deadline filter for available projects
    if (view === 'available') {
      filter.$or = [
        { applicationDeadline: { $gt: new Date() } },
        { applicationDeadline: null }
      ];
    }

    if (category) filter.projectCategory = category;
    if (difficultyLevel) filter.difficultyLevel = difficultyLevel;
    
    if (minPayRate || maxPayRate) {
      filter.payRate = {};
      if (minPayRate) filter.payRate.$gte = parseFloat(minPayRate);
      if (maxPayRate) filter.payRate.$lte = parseFloat(maxPayRate);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { projectName: searchRegex },
          { projectDescription: searchRegex },
          { tags: { $in: [searchRegex] } }
        ]
      });
    }

    console.log('🔍 Projects filter:', JSON.stringify(filter, null, 2));

    // Get user's existing applications with details
    let userApplicationsQuery = { applicantId: userId };
    
    // If viewing applied projects with specific status, filter applications first
    if (view === 'applied' && applicationStatus) {
      userApplicationsQuery.status = applicationStatus;
    }

    const userApplications = await ProjectApplication.find(userApplicationsQuery)
      .populate('projectId').lean();
    
    const appliedProjectIds = userApplications.map(app => app.projectId._id);
    const applicationMap = new Map();
    userApplications.forEach(app => {
      if (app.projectId) {
        applicationMap.set(app.projectId._id.toString(), {
          applicationId: app._id,
          status: app.status,
          appliedAt: app.appliedAt,
          approvedAt: app.approvedAt,
          rejectedAt: app.rejectedAt,
          rejectionReason: app.rejectionReason,
          reviewNotes: app.reviewNotes,
          coverLetter: app.coverLetter,
          availability: app.availability
        });
      }
    });

    // Also get ALL user applications for statistics (regardless of view filter)
    const allUserApplications = await ProjectApplication.find({ applicantId: userId }).lean();

    let finalFilter = { ...filter };
    let projects = [];
    let totalProjects = 0;

    if (view === 'available') {
      // Show only projects user hasn't applied to (need all applications for this)
      const allUserApps = await ProjectApplication.find({ applicantId: userId }).select('projectId').lean();
      const allAppliedProjectIds = allUserApps.map(app => app.projectId);
      
      if (allAppliedProjectIds.length > 0) {
        finalFilter._id = { $nin: allAppliedProjectIds };
      }
      
      projects = await AnnotationProject.find(finalFilter)
        .populate('createdBy', 'fullName email')
        .select('-assignedAdmins')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      totalProjects = await AnnotationProject.countDocuments(finalFilter);

    } else if (view === 'applied') {
      // Show only projects user has applied to (filtered by status if specified)
      if (appliedProjectIds.length === 0) {
        projects = [];
        totalProjects = 0;
      } else {
        finalFilter._id = { $in: appliedProjectIds };

        projects = await AnnotationProject.find(finalFilter)
          .populate('createdBy', 'fullName email')
          .select('-assignedAdmins')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        totalProjects = await AnnotationProject.countDocuments(finalFilter);
      }

    } else if (view === 'all') {
      // Show all active projects with application status
      projects = await AnnotationProject.find(finalFilter)
        .populate('createdBy', 'fullName email')
        .select('-assignedAdmins')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      totalProjects = await AnnotationProject.countDocuments(finalFilter);
    }

    // Add application and project metadata
    for (let project of projects) {
      // Add application count
      const appCount = await ProjectApplication.countDocuments({ 
        projectId: project._id,
        status: { $in: ['pending', 'approved'] }
      });
      project.currentApplications = appCount;
      project.availableSlots = project.maxAnnotators ? Math.max(0, project.maxAnnotators - appCount) : null;
      project.canApply = !project.maxAnnotators || appCount < project.maxAnnotators;

      // Add user's application status if exists
      const userApp = applicationMap.get(project._id.toString());
      if (userApp) {
        project.userApplication = userApp;
        project.hasApplied = true;
        project.canApply = false; // Can't apply if already applied
      } else {
        project.hasApplied = false;
      }

      // Add application deadline status
      if (project.applicationDeadline) {
        project.applicationOpen = new Date() < new Date(project.applicationDeadline);
        project.daysUntilDeadline = Math.ceil((new Date(project.applicationDeadline) - new Date()) / (1000 * 60 * 60 * 24));
        if (!project.applicationOpen) {
          project.canApply = false;
        }
      } else {
        project.applicationOpen = true;
        project.daysUntilDeadline = null;
      }
    }

    console.log(`✅ Found ${projects.length} projects for view: ${view}`);

    // Calculate pagination info
    const totalPages = Math.ceil(totalProjects / limit);

    res.status(200).json({
      success: true,
      message: `Found ${projects.length} projects (view: ${view}${applicationStatus ? `, status: ${applicationStatus}` : ''})`,
      data: {
        projects: projects,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalProjects: totalProjects,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: limit
        },
        filters: {
          view: view,
          applicationStatus: applicationStatus,
          category: category,
          difficultyLevel: difficultyLevel
        },
        userInfo: {
          annotatorStatus: user.annotatorStatus,
          appliedProjects: allUserApplications.length,
          totalApplications: allUserApplications.length,
          applicationStats: {
            pending: allUserApplications.filter(app => app.status === 'pending').length,
            approved: allUserApplications.filter(app => app.status === 'approved').length,
            rejected: allUserApplications.filter(app => app.status === 'rejected').length
          }
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching available projects:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching available projects",
      error: error.message
    });
  }
};

// DTUser function: Apply to a project
const applyToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;
    console.log(`📝 User ${req.user.email} applying to project: ${projectId}`);

    // Check if user is an approved annotator
    const user = await DTUser.findById(userId);
    console.log(`👤 User status check:`, {
      found: !!user,
      email: user?.email,
      annotatorStatus: user?.annotatorStatus,
      hasResume: !!(user?.attachments?.resume_url)
    });
    
    if (!user || user.annotatorStatus !== 'approved') {
      console.log(`❌ User ${req.user.email} access denied - Status: ${user?.annotatorStatus || 'unknown'}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Only approved annotators can apply to projects."
      });
    }

    // Check if user has uploaded their resume
    if (!user.attachments?.resume_url || user.attachments.resume_url.trim() === '') {
      console.log(`❌ User ${req.user.email} application denied - No resume uploaded`);
      return res.status(400).json({
        success: false,
        message: "Please upload your resume in your profile section",
        error: {
          code: "RESUME_REQUIRED",
          reason: "A resume is required to apply to projects",
          action: "Upload your resume in the profile section before applying"
        }
      });
    }

    console.log(`✅ User ${req.user.email} approved for project application with resume: ${user.attachments.resume_url}`);

    // Check if project exists and is available
    const AnnotationProject = require('../models/annotationProject.model');
    const project = await AnnotationProject.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    if (project.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: "Project is not currently accepting applications"
      });
    }

    // Check application deadline
    if (project.applicationDeadline && project.applicationDeadline < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Application deadline has passed"
      });
    }

    // Check if user has already applied
    const ProjectApplication = require('../models/projectApplication.model');
    const existingApplication = await ProjectApplication.findOne({
      projectId: projectId,
      applicantId: userId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this project",
        applicationStatus: existingApplication.status
      });
    }

    // Check if project is full
    if (project.maxAnnotators) {
      const currentApplications = await ProjectApplication.countDocuments({
        projectId: projectId,
        status: { $in: ['pending', 'approved'] }
      });

      if (currentApplications >= project.maxAnnotators) {
        return res.status(400).json({
          success: false,
          message: "Project has reached maximum number of applicants"
        });
      }
    }

    // Validate application data
    const { coverLetter, proposedRate, availability, estimatedCompletionTime } = req.body;

    // Create application
    const application = new ProjectApplication({
      projectId: projectId,
      applicantId: userId,
      coverLetter: coverLetter || "",
      resumeUrl: user.attachments.resume_url, // Include resume URL from user profile
      proposedRate: proposedRate || project.payRate,
      availability: availability || "flexible",
      estimatedCompletionTime: estimatedCompletionTime || "",
      status: 'pending'
    });

    await application.save();

    // Update project application count
    await AnnotationProject.findByIdAndUpdate(projectId, {
      $inc: { totalApplications: 1 }
    });

    // Populate application details for response
    await application.populate('projectId', 'projectName projectCategory payRate');

    // Send email notification to admin(s)
    try {
      const { sendProjectApplicationNotification } = require('../utils/projectMailer');
      
      // Get project creator and assigned admins
      const projectWithAdmins = await AnnotationProject.findById(projectId)
        .populate('createdBy', 'fullName email')
        .populate('assignedAdmins', 'fullName email');
      
      const applicationData = {
        applicantName: user.fullName,
        applicantEmail: user.email,
        resumeUrl: user.attachments.resume_url,
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        payRate: project.payRate,
        coverLetter: coverLetter || '',
        appliedAt: application.appliedAt
      };

      // Send notification to project creator
      if (projectWithAdmins.createdBy) {
        await sendProjectApplicationNotification(
          projectWithAdmins.createdBy.email,
          projectWithAdmins.createdBy.fullName,
          applicationData
        );
      }

      // Send notification to assigned admins (excluding creator to avoid duplicate)
      for (const admin of projectWithAdmins.assignedAdmins) {
        if (admin._id.toString() !== projectWithAdmins.createdBy._id.toString()) {
          await sendProjectApplicationNotification(
            admin.email,
            admin.fullName,
            applicationData
          );
        }
      }

      console.log(`✅ Admin notifications sent for project application: ${project.projectName}`);
      
    } catch (emailError) {
      console.error(`⚠️ Failed to send admin notification for application:`, emailError.message);
      // Don't fail the request if email fails
    }

    console.log(`✅ Application submitted successfully for project: ${project.projectName}`);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: {
        application: application,
        projectName: project.projectName
      }
    });

  } catch (error) {
    console.error("❌ Error applying to project:", error);
    res.status(500).json({
      success: false,
      message: "Server error while applying to project",
      error: error.message
    });
  }
};

// DTUser function: Get user's active projects
const getUserActiveProjects = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    console.log(`🔍 Getting active projects for user: ${userId}`);

    // Verify user has access to this data
    if (req.user.userId.toString() !== userId && !req.admin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own projects."
      });
    }

    const ProjectApplication = require('../models/projectApplication.model');
    
    // Get all user's applications with project details
    const applications = await ProjectApplication.find({ applicantId: userId })
      .populate({
        path: 'projectId',
        select: 'projectName projectDescription projectCategory payRate payRateType status createdBy',
        populate: {
          path: 'createdBy',
          select: 'fullName email'
        }
      })
      .sort({ appliedAt: -1 })
      .lean();

    // Separate applications by status
    const activeProjects = applications.filter(app => app.status === 'approved');
    const pendingApplications = applications.filter(app => app.status === 'pending');
    const rejectedApplications = applications.filter(app => app.status === 'rejected');

    // Calculate statistics
    const stats = {
      totalApplications: applications.length,
      activeProjects: activeProjects.length,
      pendingApplications: pendingApplications.length,
      rejectedApplications: rejectedApplications.length
    };

    console.log(`✅ Found ${applications.length} applications for user`);

    res.status(200).json({
      success: true,
      message: "User projects retrieved successfully",
      data: {
        activeProjects: activeProjects,
        pendingApplications: pendingApplications,
        rejectedApplications: rejectedApplications,
        statistics: stats
      }
    });

  } catch (error) {
    console.error("❌ Error fetching user active projects:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user projects",
      error: error.message
    });
  }
};

// ===== INVOICE MANAGEMENT FUNCTIONS =====

// DTUser function: Get all invoices for the user
const getUserInvoices = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    const { 
      page = 1, 
      limit = 20, 
      paymentStatus, 
      projectId,
      startDate,
      endDate
    } = req.query;

    console.log(`📄 DTUser ${userId} fetching invoices`);

    // Build filter object
    const filter = { dtUserId: userId };
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (projectId) filter.projectId = projectId;

    // Date range filter
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get invoices with populated data
    const invoices = await Invoice.find(filter)
      .populate('projectId', 'projectName projectCategory payRate')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalInvoices = await Invoice.countDocuments(filter);

    // Get user invoice statistics
    const stats = await Invoice.getInvoiceStats(userId);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalInvoices / limit),
          totalInvoices,
          invoicesPerPage: parseInt(limit)
        },
        statistics: {
          totalInvoices: stats.totalInvoices,
          totalEarnings: stats.totalAmount,
          paidAmount: stats.paidAmount,
          unpaidAmount: stats.unpaidAmount,
          overdueAmount: stats.overdueAmount,
          unpaidCount: stats.unpaidCount,
          paidCount: stats.paidCount,
          overdueCount: stats.overdueCount
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching user invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoices",
      error: error.message
    });
  }
};

// DTUser function: Get unpaid invoices specifically
const getUnpaidInvoices = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    console.log(`💰 DTUser ${userId} fetching unpaid invoices`);

    const skip = (page - 1) * limit;

    // Get unpaid and overdue invoices
    const unpaidInvoices = await Invoice.find({ 
      dtUserId: userId, 
      paymentStatus: { $in: ['unpaid', 'overdue'] }
    })
      .populate('projectId', 'projectName projectCategory')
      .populate('createdBy', 'fullName email')
      .sort({ dueDate: 1 }) // Sort by due date ascending (most urgent first)
      .skip(skip)
      .limit(parseInt(limit));

    const totalUnpaid = await Invoice.countDocuments({ 
      dtUserId: userId, 
      paymentStatus: { $in: ['unpaid', 'overdue'] }
    });

    // Calculate total amount due
    const totalAmountDue = await Invoice.aggregate([
      { 
        $match: { 
          dtUserId: new mongoose.Types.ObjectId(userId), 
          paymentStatus: { $in: ['unpaid', 'overdue'] }
        }
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$invoiceAmount' },
          overdueAmount: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, '$invoiceAmount', 0]
            }
          }
        }
      }
    ]);

    const amountSummary = totalAmountDue[0] || { totalDue: 0, overdueAmount: 0 };

    res.status(200).json({
      success: true,
      data: {
        unpaidInvoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUnpaid / limit),
          totalUnpaidInvoices: totalUnpaid,
          invoicesPerPage: parseInt(limit)
        },
        summary: {
          totalAmountDue: amountSummary.totalDue,
          overdueAmount: amountSummary.overdueAmount,
          unpaidCount: totalUnpaid
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching unpaid invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching unpaid invoices",
      error: error.message
    });
  }
};

// DTUser function: Get paid invoices specifically  
const getPaidInvoices = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    console.log(`✅ DTUser ${userId} fetching paid invoices`);

    const skip = (page - 1) * limit;

    // Get paid invoices
    const paidInvoices = await Invoice.find({ 
      dtUserId: userId, 
      paymentStatus: 'paid'
    })
      .populate('projectId', 'projectName projectCategory')
      .populate('createdBy', 'fullName email')
      .sort({ paidAt: -1 }) // Sort by payment date descending
      .skip(skip)
      .limit(parseInt(limit));

    const totalPaid = await Invoice.countDocuments({ 
      dtUserId: userId, 
      paymentStatus: 'paid'
    });

    // Calculate total earnings
    const totalEarnings = await Invoice.aggregate([
      { 
        $match: { 
          dtUserId: new mongoose.Types.ObjectId(userId), 
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$invoiceAmount' }
        }
      }
    ]);

    const earnings = totalEarnings[0]?.totalEarnings || 0;

    res.status(200).json({
      success: true,
      data: {
        paidInvoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPaid / limit),
          totalPaidInvoices: totalPaid,
          invoicesPerPage: parseInt(limit)
        },
        summary: {
          totalEarnings: earnings,
          paidCount: totalPaid
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching paid invoices:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching paid invoices",
      error: error.message
    });
  }
};

// DTUser function: Get specific invoice details
const getInvoiceDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { invoiceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID"
      });
    }

    // Find invoice and ensure it belongs to the user
    const invoice = await Invoice.findOne({ 
      _id: invoiceId, 
      dtUserId: userId 
    })
      .populate('projectId', 'projectName projectDescription projectCategory')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found or access denied"
      });
    }

    // Mark invoice as viewed if not already
    if (!invoice.emailViewedAt) {
      invoice.emailViewedAt = new Date();
      await invoice.save();
    }

    res.status(200).json({
      success: true,
      data: {
        invoice,
        computedFields: {
          daysOverdue: invoice.daysOverdue,
          amountDue: invoice.amountDue,
          formattedInvoiceNumber: invoice.formattedInvoiceNumber
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching invoice details:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoice details",
      error: error.message
    });
  }
};

// DTUser function: Get invoice dashboard summary
const getInvoiceDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log(`📊 DTUser ${userId} fetching invoice dashboard`);
    console.log(`🔍 User ID type: ${typeof userId}, value: ${userId}`);

    // Convert userId to ObjectId if it's a string
    const objectId = new mongoose.Types.ObjectId(userId);
    console.log(`🔍 ObjectId: ${objectId}`);

    // Debug: Check if any invoices exist for this user
    const totalInvoices = await Invoice.countDocuments({ dtUserId: objectId });
    console.log(`🔍 Total invoices found for user: ${totalInvoices}`);

    // Debug: Get all invoices for this user to inspect their paymentStatus
    const allInvoices = await Invoice.find({ dtUserId: objectId }).select('invoiceAmount paymentStatus paidAt createdAt');
    console.log(`🔍 All user invoices:`, allInvoices);

    // Get comprehensive statistics
    const stats = await Invoice.getInvoiceStats(objectId);
    console.log(`📈 Calculated stats:`, stats);

    // Get recent invoices (last 5)
    const recentInvoices = await Invoice.find({ dtUserId: objectId })
      .populate('projectId', 'projectName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get overdue invoices
    const overdueInvoices = await Invoice.find({ 
      dtUserId: objectId, 
      paymentStatus: 'overdue' 
    })
      .populate('projectId', 'projectName')
      .sort({ dueDate: 1 });

    // Get earnings by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await Invoice.aggregate([
      {
        $match: {
          dtUserId: objectId,
          paymentStatus: 'paid',
          paidAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' }
          },
          totalEarnings: { $sum: '$invoiceAmount' },
          invoiceCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    console.log(`📊 Dashboard response data:`, {
      statistics: stats,
      recentInvoicesCount: recentInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      monthlyEarningsCount: monthlyEarnings.length
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: stats,
        recentInvoices,
        overdueInvoices,
        monthlyEarnings,
        summary: {
          totalEarned: stats.paidAmount,
          pendingPayments: stats.unpaidAmount,
          overduePayments: stats.overdueAmount,
          totalInvoices: stats.totalInvoices,
          unpaidCount: stats.unpaidCount,
          overdueCount: stats.overdueCount
        },
        debug: {
          totalInvoicesInDb: totalInvoices,
          allInvoices: allInvoices
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching invoice dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching invoice dashboard",
      error: error.message
    });
  }
};

// DTUser Dashboard - Personal overview for authenticated users
const getDTUserDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    console.log(`📊 DTUser ${userEmail} requesting personal dashboard`);

    // Get current date for time-based filtering
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(currentDate.getDate() - 30);
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7);

    // ===== GET USER PROFILE =====
    const user = await DTUser.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ===== PROFILE COMPLETION ANALYSIS =====
    const profileCompletion = {
      basicInfo: {
        completed: !!(user.fullName && user.email && user.phone),
        fields: ['fullName', 'email', 'phone']
      },
      personalInfo: {
        completed: !!(user.personal_info?.country && user.personal_info?.time_zone && user.personal_info?.available_hours_per_week),
        fields: ['country', 'time_zone', 'available_hours_per_week']
      },
      professionalBackground: {
        completed: !!(user.professional_background?.education_field && user.professional_background?.years_of_experience),
        fields: ['education_field', 'years_of_experience']
      },
      paymentInfo: {
        completed: !!(user.payment_info?.account_name && user.payment_info?.account_number && user.payment_info?.bank_name),
        fields: ['account_name', 'account_number', 'bank_name']
      },
      attachments: {
        completed: !!(user.attachments?.resume_url && user.attachments?.id_document_url),
        fields: ['resume_url', 'id_document_url']
      },
      profilePicture: {
        completed: !!(user.profilePicture?.url),
        fields: ['profile_picture']
      }
    };

    // Calculate overall completion percentage
    const completionSections = Object.values(profileCompletion);
    const completedSections = completionSections.filter(section => section.completed).length;
    const completionPercentage = Math.round((completedSections / completionSections.length) * 100);

    // ===== PROJECT APPLICATIONS =====
    const applicationStats = await ProjectApplication.aggregate([
      {
        $match: { dtUserId: new mongoose.Types.ObjectId(userId) }
      },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          pendingApplications: { 
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approvedApplications: { 
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedApplications: { 
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent applications
    const recentApplications = await ProjectApplication.find({ dtUserId: userId })
      .populate('projectId', 'projectName budget timeline status')
      .sort({ appliedAt: -1 })
      .limit(5)
      .select('status appliedAt projectId');

    // ===== INVOICE STATISTICS =====
    const invoiceStats = await Invoice.aggregate([
      {
        $match: { dtUserId: new mongoose.Types.ObjectId(userId) }
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalEarnings: { $sum: '$invoiceAmount' },
          paidEarnings: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0] }
          },
          pendingEarnings: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$invoiceAmount', 0] }
          },
          overdueEarnings: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, '$invoiceAmount', 0] }
          },
          paidInvoices: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          pendingInvoices: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
          },
          overdueInvoices: { 
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent payments (last 30 days)
    const recentPayments = await Invoice.aggregate([
      {
        $match: {
          dtUserId: new mongoose.Types.ObjectId(userId),
          paymentStatus: 'paid',
          paidAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            day: { $dayOfMonth: '$paidAt' }
          },
          dailyEarnings: { $sum: '$invoiceAmount' },
          invoiceCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Recent invoices
    const recentInvoices = await Invoice.find({ dtUserId: userId })
      .populate('projectId', 'projectName')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('invoiceAmount paymentStatus dueDate paidAt createdAt projectId');

    // ===== RESULT SUBMISSIONS =====
    const resultSubmissions = {
      totalSubmissions: user.resultSubmissions?.length || 0,
      recentSubmissions: user.resultSubmissions?.slice(-5) || [],
      lastSubmissionDate: user.resultSubmissions?.length > 0 ? 
        Math.max(...user.resultSubmissions.map(sub => new Date(sub.submissionDate))) : null
    };

    // ===== AVAILABLE PROJECTS =====
    const availableProjects = await AnnotationProject.find({
      status: 'active',
      'requirements.maxAnnotators': { $gt: 0 }
    })
    .select('projectName description budget timeline requirements status')
    .sort({ createdAt: -1 })
    .limit(5);

    // Check which projects user has already applied to
    const userApplications = await ProjectApplication.find({ dtUserId: userId })
      .select('projectId status');
    
    const appliedProjectIds = userApplications.map(app => app.projectId.toString());
    
    // Mark available projects with application status
    const availableProjectsWithStatus = availableProjects.map(project => ({
      ...project.toObject(),
      hasApplied: appliedProjectIds.includes(project._id.toString()),
      applicationStatus: userApplications.find(app => 
        app.projectId.toString() === project._id.toString()
      )?.status || null
    }));

    // ===== PERFORMANCE METRICS =====
    const performanceMetrics = {
      profileCompletionPercentage: completionPercentage,
      applicationSuccessRate: (applicationStats[0]?.totalApplications || 0) > 0 ? 
        Math.round(((applicationStats[0]?.approvedApplications || 0) / applicationStats[0].totalApplications) * 100) : 0,
      paymentRate: (invoiceStats[0]?.totalInvoices || 0) > 0 ? 
        Math.round(((invoiceStats[0]?.paidInvoices || 0) / invoiceStats[0].totalInvoices) * 100) : 0,
      avgEarningsPerInvoice: (invoiceStats[0]?.totalInvoices || 0) > 0 ? 
        Math.round((invoiceStats[0]?.totalEarnings || 0) / invoiceStats[0].totalInvoices) : 0,
      accountStatus: {
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword
      }
    };

    // ===== NEXT STEPS RECOMMENDATIONS =====
    const nextSteps = [];
    
    if (!user.isEmailVerified) {
      nextSteps.push({
        priority: 'high',
        action: 'verify_email',
        title: 'Verify Your Email',
        description: 'Complete email verification to unlock all features'
      });
    }
    
    if (!user.hasSetPassword) {
      nextSteps.push({
        priority: 'high',
        action: 'setup_password',
        title: 'Set Up Password',
        description: 'Create a secure password for your account'
      });
    }
    
    if (completionPercentage < 80) {
      nextSteps.push({
        priority: 'medium',
        action: 'complete_profile',
        title: 'Complete Your Profile',
        description: `Your profile is ${completionPercentage}% complete. Add missing information to improve your chances of approval.`
      });
    }
    
    if (!user.attachments?.resume_url) {
      nextSteps.push({
        priority: 'medium',
        action: 'upload_resume',
        title: 'Upload Resume',
        description: 'Upload your resume to showcase your experience'
      });
    }
    
    if (!user.attachments?.id_document_url) {
      nextSteps.push({
        priority: 'medium',
        action: 'upload_id',
        title: 'Upload ID Document',
        description: 'Upload a valid ID document for verification'
      });
    }
    
    if (user.annotatorStatus === 'pending' && !user.resultLink) {
      nextSteps.push({
        priority: 'high',
        action: 'submit_result',
        title: 'Submit Work Sample',
        description: 'Upload a work sample to demonstrate your skills'
      });
    }
    
    if (user.annotatorStatus === 'approved' && (applicationStats[0]?.totalApplications || 0) === 0) {
      nextSteps.push({
        priority: 'medium',
        action: 'apply_projects',
        title: 'Apply to Projects',
        description: 'Browse and apply to available annotation projects'
      });
    }

    // ===== COMPILE DASHBOARD DATA =====
    const dashboardData = {
      userProfile: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        annotatorStatus: user.annotatorStatus,
        microTaskerStatus: user.microTaskerStatus,
        isEmailVerified: user.isEmailVerified,
        hasSetPassword: user.hasSetPassword,
        joinedDate: user.createdAt,
        profilePicture: user.profilePicture?.url || null
      },
      
      profileCompletion: {
        percentage: completionPercentage,
        sections: profileCompletion,
        completedSections: completedSections,
        totalSections: completionSections.length
      },
      
      applicationStatistics: applicationStats[0] || {
        totalApplications: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0
      },
      
      financialSummary: invoiceStats[0] || {
        totalInvoices: 0,
        totalEarnings: 0,
        paidEarnings: 0,
        pendingEarnings: 0,
        overdueEarnings: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0
      },
      
      resultSubmissions: resultSubmissions,
      
      recentActivity: {
        recentApplications: recentApplications,
        recentInvoices: recentInvoices,
        recentPayments: recentPayments
      },
      
      availableOpportunities: {
        availableProjects: availableProjectsWithStatus,
        projectCount: availableProjectsWithStatus.length
      },
      
      performanceMetrics: performanceMetrics,
      
      recommendations: {
        nextSteps: nextSteps,
        priorityActions: nextSteps.filter(step => step.priority === 'high').length
      },
      
      generatedAt: new Date(),
      timeframe: {
        recentActivity: '30 days',
        availableProjects: 'current active projects'
      }
    };

    console.log(`✅ Dashboard generated for user: ${userEmail}`);

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error("❌ Error generating DTUser dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating user dashboard",
      error: error.message
    });
  }
};

// Submit result file upload and store in Cloudinary
const submitResultWithCloudinary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { projectId, notes } = req.body;
    
    console.log(`📤 User ${req.user.email} uploading result file`);

    // Validate that a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Result file is required. Please upload a file.'
      });
    }

    // Get user details
    const user = await DTUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`📁 Processing uploaded file: ${req.file.originalname}`);

    // Import cloudinary functions
    const { generateOptimizedUrl, generateThumbnail } = require('../config/cloudinary');

    try {
      // The file is already uploaded to Cloudinary via multer middleware
      const uploadResult = req.file;
      
      console.log(`✅ Result uploaded to Cloudinary: ${uploadResult.filename}`);

      // Generate optimized URLs based on file type
      let optimizedUrl = uploadResult.path;
      let thumbnailUrl = null;

      if (uploadResult.mimetype && uploadResult.mimetype.startsWith('image/')) {
        optimizedUrl = generateOptimizedUrl(uploadResult.filename, {
          width: 1200,
          height: 800,
          crop: 'limit',
          quality: 'auto'
        });

        thumbnailUrl = generateThumbnail(uploadResult.filename, 300);
      }

      // Create result submission object
      const resultSubmission = {
        originalResultLink: '', // Not applicable for direct uploads
        cloudinaryResultData: {
          publicId: uploadResult.filename,
          url: uploadResult.path,
          optimizedUrl: optimizedUrl,
          thumbnailUrl: thumbnailUrl,
          originalName: uploadResult.originalname,
          size: uploadResult.size,
          format: uploadResult.format || uploadResult.filename.split('.').pop()
        },
        submissionDate: new Date(),
        projectId: projectId || null,
        status: 'stored',
        notes: notes || '',
        uploadMethod: 'direct_upload' // Track that this was a direct upload
      };

      // Add to user's result submissions
      if (!user.resultSubmissions) {
        user.resultSubmissions = [];
      }
      user.resultSubmissions.push(resultSubmission);

      // Update the main resultLink field with the Cloudinary URL (for backward compatibility)
      user.resultLink = uploadResult.path;

      // Update annotatorStatus to "submitted" when user submits a result
      if (user.annotatorStatus === "pending" || user.annotatorStatus === "verified") {
        user.annotatorStatus = "submitted";
        console.log(`📊 Updated annotatorStatus to "submitted" for user: ${user.email}`);
      }

      // Save user with new result
      await user.save();

      console.log(`✅ Result submission saved for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Result file uploaded and stored successfully in Cloudinary',
        data: {
          resultSubmission: {
            id: user.resultSubmissions[user.resultSubmissions.length - 1]._id,
            originalFileName: uploadResult.originalname,
            cloudinaryUrl: uploadResult.path,
            optimizedUrl: optimizedUrl,
            thumbnailUrl: thumbnailUrl,
            submissionDate: resultSubmission.submissionDate,
            status: 'stored',
            fileSize: uploadResult.size,
            fileFormat: resultSubmission.cloudinaryResultData.format
          },
          totalResultSubmissions: user.resultSubmissions.length,
          updatedResultLink: user.resultLink, // The main resultLink field
          updatedAnnotatorStatus: user.annotatorStatus // Include updated status
        }
      });

    } catch (cloudinaryError) {
      console.error('❌ Cloudinary processing error:', cloudinaryError);
      
      // Create a failed submission record
      const failedSubmission = {
        originalResultLink: '',
        cloudinaryResultData: {
          publicId: '',
          url: '',
          optimizedUrl: '',
          thumbnailUrl: '',
          originalName: req.file?.originalname || 'unknown_file',
          size: req.file?.size || 0,
          format: ''
        },
        submissionDate: new Date(),
        projectId: projectId || null,
        status: 'failed',
        notes: `Upload processing failed: ${cloudinaryError.message}. ${notes || ''}`,
        uploadMethod: 'direct_upload'
      };

      if (!user.resultSubmissions) {
        user.resultSubmissions = [];
      }
      user.resultSubmissions.push(failedSubmission);
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Failed to process uploaded file',
        error: cloudinaryError.message,
        data: {
          originalFileName: req.file?.originalname,
          status: 'failed',
          submissionDate: failedSubmission.submissionDate
        }
      });
    }

  } catch (error) {
    console.error('❌ Error processing result upload:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing result upload',
      error: error.message
    });
  }
};

// Upload ID Document and store in user profile
const uploadIdDocument = async (req, res) => {
  try {
    const user = req.user;
    console.log(`🆔 User ${user.email} uploading ID document`);

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'ID document file is required. Please upload a file.'
      });
    }

    // Find the user in the database
    const dtUser = await DTUser.findOne({ 
      email: user.email,
      _id: user.userId 
    });

    if (!dtUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    try {
      const uploadResult = req.file;
      console.log(`✅ ID document uploaded to Cloudinary: ${uploadResult.filename}`);

      // Update user's attachments with ID document URL
      dtUser.attachments.id_document_url = uploadResult.path;

      // Save the updated user
      const updatedUser = await dtUser.save();

      console.log(`✅ ID document saved for user: ${user.email}`);
      
      res.status(200).json({
        success: true,
        message: 'ID document uploaded and stored successfully',
        data: {
          id_document_url: updatedUser.attachments.id_document_url,
          cloudinaryData: {
            url: uploadResult.path,
            publicId: uploadResult.filename,
            originalName: uploadResult.originalname,
            fileSize: uploadResult.size,
            format: uploadResult.format || uploadResult.mimetype
          }
        }
      });

    } catch (cloudinaryError) {
      console.error('❌ Cloudinary processing error:', cloudinaryError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to process uploaded ID document',
        error: cloudinaryError.message
      });
    }

  } catch (error) {
    console.error('❌ Error in ID document upload:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during ID document upload',
      error: error.message
    });
  }
};

// Upload Resume and store in user profile
const uploadResume = async (req, res) => {
  try {
    const user = req.user;
    console.log(`📄 User ${user.email} uploading resume`);

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Resume file is required. Please upload a file.'
      });
    }

    // Find the user in the database
    const dtUser = await DTUser.findOne({ 
      email: user.email,
      _id: user.userId 
    });

    if (!dtUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    try {
      const uploadResult = req.file;
      console.log(`✅ Resume uploaded to Cloudinary: ${uploadResult.filename}`);

      // Update user's attachments with resume URL
      dtUser.attachments.resume_url = uploadResult.path;

      // Save the updated user
      const updatedUser = await dtUser.save();

      console.log(`✅ Resume saved for user: ${user.email}`);
      
      res.status(200).json({
        success: true,
        message: 'Resume uploaded and stored successfully',
        data: {
          resume_url: updatedUser.attachments.resume_url,
          cloudinaryData: {
            url: uploadResult.path,
            publicId: uploadResult.filename,
            originalName: uploadResult.originalname,
            fileSize: uploadResult.size,
            format: uploadResult.format || uploadResult.mimetype
          }
        }
      });

    } catch (cloudinaryError) {
      console.error('❌ Cloudinary processing error:', cloudinaryError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to process uploaded resume',
        error: cloudinaryError.message
      });
    }

  } catch (error) {
    console.error('❌ Error in resume upload:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during resume upload',
      error: error.message
    });
  }
};

// Get all result submissions for a user
const getUserResultSubmissions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;
    
    console.log(`📋 User ${req.user.email} requesting result submissions`);

    const user = await DTUser.findById(userId).populate('resultSubmissions.projectId', 'projectName projectCategory');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let resultSubmissions = user.resultSubmissions || [];
    
    // Filter by status if provided
    if (status && ['pending', 'processing', 'stored', 'failed'].includes(status)) {
      resultSubmissions = resultSubmissions.filter(submission => submission.status === status);
    }

    // Sort by submission date (newest first)
    resultSubmissions.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = resultSubmissions.slice(startIndex, endIndex);

    // Format results for response
    const formattedResults = paginatedResults.map(submission => ({
      id: submission._id,
      originalLink: submission.originalResultLink,
      cloudinaryData: submission.cloudinaryResultData,
      submissionDate: submission.submissionDate,
      projectInfo: submission.projectId ? {
        id: submission.projectId._id,
        name: submission.projectId.projectName,
        category: submission.projectId.projectCategory
      } : null,
      status: submission.status,
      notes: submission.notes
    }));

    // Calculate statistics
    const stats = {
      total: resultSubmissions.length,
      stored: resultSubmissions.filter(s => s.status === 'stored').length,
      failed: resultSubmissions.filter(s => s.status === 'failed').length,
      pending: resultSubmissions.filter(s => s.status === 'pending').length
    };

    res.status(200).json({
      success: true,
      message: 'Result submissions retrieved successfully',
      data: {
        submissions: formattedResults,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(resultSubmissions.length / limit),
          totalSubmissions: resultSubmissions.length,
          hasMore: endIndex < resultSubmissions.length
        },
        statistics: stats
      }
    });

  } catch (error) {
    console.error('❌ Error getting result submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving result submissions',
      error: error.message
    });
  }
};

// Get project guidelines for approved annotators only
const getProjectGuidelines = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId || req.user?.userId;

    console.log(`🔍 User ${userId} requesting guidelines for project: ${projectId}`);

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to access project guidelines"
      });
    }

    // Find the project
    const AnnotationProject = require('../models/annotationProject.model');
    const project = await AnnotationProject.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // Check if user has an approved application for this project
    const ProjectApplication = require('../models/projectApplication.model');
    const approvedApplication = await ProjectApplication.findOne({
      projectId: projectId,
      applicantId: userId,
      status: 'approved'
    });

    if (!approvedApplication) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only approved annotators can access project guidelines.",
        error: {
          code: "GUIDELINES_ACCESS_DENIED",
          reason: "User must have an approved application for this project",
          userStatus: "not_approved_for_project"
        }
      });
    }

    // Return project guidelines
    const guidelinesData = {
      projectInfo: {
        id: project._id,
        name: project.projectName,
        description: project.projectDescription,
        category: project.projectCategory,
        payRate: project.payRate,
        payRateCurrency: project.payRateCurrency,
        payRateType: project.payRateType,
        difficultyLevel: project.difficultyLevel,
        deadline: project.deadline
      },
      guidelines: {
        documentLink: project.projectGuidelineLink,
        videoLink: project.projectGuidelineVideo || null,
        communityLink: project.projectCommunityLink || null,
        trackerLink: project.projectTrackerLink || null
      },
      userApplication: {
        appliedAt: approvedApplication.appliedAt,
        approvedAt: approvedApplication.reviewedAt,
        workStartedAt: approvedApplication.workStartedAt,
        status: approvedApplication.status
      },
      accessInfo: {
        accessGrantedAt: new Date(),
        accessType: "approved_annotator",
        userRole: "annotator"
      }
    };

    console.log(`✅ Project guidelines provided to approved user: ${userId} for project: ${project.projectName}`);

    res.status(200).json({
      success: true,
      message: "Project guidelines retrieved successfully",
      data: guidelinesData
    });

  } catch (error) {
    console.error("❌ Error retrieving project guidelines:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving project guidelines",
      error: error.message
    });
  }
};

module.exports = { 
  createDTUser, 
  createDTUserWithBackgroundEmail, 
  verifyEmail, 
  setupPassword, 
  dtUserLogin, 
  getDTUserProfile, 
  updateDTUserProfile,
  resetDTUserPassword,
  resendVerificationEmail,
  getDTUser,
  getAllDTUsers,
  getAllAdminUsers,
  getAdminDashboard,
  getDTUserDashboard,
  approveAnnotator,
  rejectAnnotator,
  getDTUserAdmin,
  requestAdminVerification,
  confirmAdminVerification,
  createAdmin,
  verifyAdminOTP,
  adminLogin,
  getAvailableProjects,
  applyToProject,
  getUserActiveProjects,
  getUserInvoices,
  getUnpaidInvoices,
  getPaidInvoices,
  getInvoiceDetails,
  getInvoiceDashboard,
  submitResultWithCloudinary,
  getUserResultSubmissions,
  uploadIdDocument,
  uploadResume,
  getProjectGuidelines
};
