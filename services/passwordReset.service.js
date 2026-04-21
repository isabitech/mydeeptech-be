const User = require("../models/user");
const DTUser = require("../models/dtUser.model");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const MailService = require("./mail-service/mail-service");

const generateResetToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const RESET_WINDOW_MS = 60 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

const lowerCaseEmail = (email) => email.toLowerCase();

const buildGenericResetMessage = () => ({
  message:
    "If an account with that email exists, we have sent a password reset link.",
});

const buildResetSuccessMessage = (email) => ({
  message: "Password reset link has been sent to your email address.",
  data: { email, expiresIn: "1 hour" },
});

const buildResetCompleteMessage = (email) => ({
  message:
    "Password has been reset successfully. You can now log in with your new password.",
  data: { email, resetAt: new Date().toISOString() },
});

const isTooManyAttempts = (account) => {
  const oneHourAgo = new Date(Date.now() - RESET_WINDOW_MS);
  return (
    account.passwordResetAttempts >= MAX_RESET_ATTEMPTS &&
    account.passwordResetExpires &&
    account.passwordResetExpires > oneHourAgo
  );
};

const clearResetState = (account) => {
  account.passwordResetToken = null;
  account.passwordResetExpires = null;
};

const applyResetToken = (account, resetToken) => {
  account.passwordResetToken = hashToken(resetToken);
  account.passwordResetExpires = new Date(Date.now() + RESET_WINDOW_MS);
  account.passwordResetAttempts = (account.passwordResetAttempts || 0) + 1;
};

const getResetAccount = async (type, query) => {
  return type === "dtuser" ? DTUser.findOne(query) : User.findOne(query);
};

const sendResetEmail = async (type, email, name, resetToken) => {
  const recipientType = type === "dtuser" ? "dtuser" : "user";
  return MailService.sendPasswordResetEmailWithType(
    email,
    name,
    resetToken,
    recipientType,
  );
};

const sendConfirmationEmail = async (type, email, name) => {
  const recipientType = type === "dtuser" ? "dtuser" : "user";
  return MailService.sendPasswordResetConfirmationEmail(
    email,
    name,
    recipientType,
  );
};

const validateResetInputs = (token, password, confirmPassword) => {
  if (!token || !password || !confirmPassword) {
    throw {
      status: 400,
      message: "Token, password, and confirm password are required",
    };
  }

  if (password !== confirmPassword) {
    throw { status: 400, message: "Passwords do not match" };
  }

  if (password.length < 8) {
    throw {
      status: 400,
      message: "Password must be at least 8 characters long",
    };
  }
};

class PasswordResetService {
  /**
   * Initiate password reset for a regular User
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email: lowerCaseEmail(email) });

    // Always respond the same to prevent email enumeration
    if (!user) return buildGenericResetMessage();

    // Rate limit: max 5 attempts per hour
    if (isTooManyAttempts(user)) {
      throw {
        status: 429,
        message: "Too many password reset attempts. Please try again later.",
      };
    }

    const resetToken = generateResetToken();
    applyResetToken(user, resetToken);
    await user.save();

    try {
      await sendResetEmail(
        "user",
        user.email,
        user.firstname || user.username,
        resetToken,
      );
    } catch (emailError) {
      clearResetState(user);
      await user.save();
      throw {
        status: 500,
        message: "Failed to send reset email. Please try again later.",
      };
    }

    return buildResetSuccessMessage(user.email);
  }

  /**
   * Complete password reset for a regular User
   */
  async resetPassword(token, password, confirmPassword) {
    validateResetInputs(token, password, confirmPassword);

    const user = await User.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user)
      throw {
        status: 400,
        message: "Password reset token is invalid or has expired",
      };

    user.password = await bcrypt.hash(password, 12);
    clearResetState(user);
    user.passwordResetAttempts = 0;
    await user.save();

    try {
      await sendConfirmationEmail(
        "user",
        user.email,
        user.firstname || user.username,
      );
    } catch (e) {
      /* non-fatal */
    }

    return buildResetCompleteMessage(user.email);
  }

  /**
   * Initiate password reset for a DTUser
   */
  async dtUserForgotPassword(email) {
    const dtUser = await DTUser.findOne({ email: lowerCaseEmail(email) });
    if (!dtUser) return buildGenericResetMessage();

    if (!dtUser.hasSetPassword || !dtUser.password) {
      throw {
        status: 400,
        message:
          "This account does not have a password set. Please complete your registration first.",
      };
    }

    if (isTooManyAttempts(dtUser)) {
      throw {
        status: 429,
        message: "Too many password reset attempts. Please try again later.",
      };
    }

    const resetToken = generateResetToken();
    applyResetToken(dtUser, resetToken);
    await dtUser.save();

    try {
      await sendResetEmail("dtuser", dtUser.email, dtUser.fullName, resetToken);
    } catch (emailError) {
      clearResetState(dtUser);
      await dtUser.save();
      throw {
        status: 500,
        message: "Failed to send reset email. Please try again later.",
      };
    }

    return buildResetSuccessMessage(dtUser.email);
  }

  /**
   * Complete password reset for a DTUser
   */
  async dtUserResetPassword(token, password, confirmPassword) {
    validateResetInputs(token, password, confirmPassword);

    const dtUser = await DTUser.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    });
    if (!dtUser)
      throw {
        status: 400,
        message: "Password reset token is invalid or has expired",
      };

    dtUser.password = await bcrypt.hash(password, 12);
    dtUser.hasSetPassword = true;
    clearResetState(dtUser);
    dtUser.passwordResetAttempts = 0;
    await dtUser.save();

    try {
      await sendConfirmationEmail("dtuser", dtUser.email, dtUser.fullName);
    } catch (e) {
      /* non-fatal */
    }

    return buildResetCompleteMessage(dtUser.email);
  }

  /**
   * Verify reset token validity
   */
  async verifyResetToken(token, type) {
    if (!token) throw { status: 400, message: "Token is required" };

    const hashedToken = hashToken(token);
    const query = {
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    };
    const user = await getResetAccount(type, query);

    if (!user)
      throw { status: 400, message: "Token is invalid or has expired" };

    return {
      message: "Token is valid",
      data: { email: user.email, expiresAt: user.passwordResetExpires },
    };
  }
}

module.exports = new PasswordResetService();
