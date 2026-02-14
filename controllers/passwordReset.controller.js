const User = require('../models/user');
const DTUser = require('../models/dtUser.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail, sendPasswordResetConfirmationEmail } = require('../utils/passwordResetMailer');

/**
 * Generate secure random token for password reset
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash token for secure storage in database
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Forgot Password - Send reset email for regular users
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal that email doesn't exist for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Check rate limiting (max 5 attempts per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user.passwordResetAttempts >= 5 && user.passwordResetExpires && user.passwordResetExpires > oneHourAgo) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset attempts. Please try again later.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);

    // Update user with reset token and expiry (1 hour)
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(
        user.email, 
        user.firstname || user.username, 
        resetToken, 
        'user'
      );

      console.log(`🔐 Password reset token generated for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password reset link has been sent to your email address.',
        data: {
          email: user.email,
          expiresIn: '1 hour'
        }
      });

    } catch (emailError) {
      // Clear reset token if email fails
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      console.error('❌ Failed to send reset email:', emailError);

      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email. Please try again later.'
      });
    }

  } catch (error) {
    console.error('❌ Error in forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing forgot password request',
      error: error.message
    });
  }
};

/**
 * Reset Password - Verify token and update password for regular users
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, password, and confirm password are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Hash the token to compare with database
    const hashedToken = hashToken(token);

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset fields
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.passwordResetAttempts = 0;
    await user.save();

    // Send confirmation email
    try {
      await sendPasswordResetConfirmationEmail(
        user.email, 
        user.firstname || user.username, 
        'user'
      );
    } catch (emailError) {
      console.warn('⚠️ Failed to send confirmation email:', emailError);
      // Don't fail the password reset if confirmation email fails
    }

    console.log(`✅ Password successfully reset for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
      data: {
        email: user.email,
        resetAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing password reset',
      error: error.message
    });
  }
};

/**
 * Forgot Password - Send reset email for DTUsers
 * POST /api/auth/dtuser-forgot-password
 */
const dtUserForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find DTUser by email
    const dtUser = await DTUser.findOne({ email: email.toLowerCase() });
    if (!dtUser) {
      // Don't reveal that email doesn't exist for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Check if user has set a password
    if (!dtUser.hasSetPassword || !dtUser.password) {
      return res.status(400).json({
        success: false,
        message: 'This account does not have a password set. Please complete your registration first.'
      });
    }

    // Check rate limiting (max 5 attempts per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (dtUser.passwordResetAttempts >= 5 && dtUser.passwordResetExpires && dtUser.passwordResetExpires > oneHourAgo) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset attempts. Please try again later.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);

    // Update DTUser with reset token and expiry (1 hour)
    dtUser.passwordResetToken = hashedToken;
    dtUser.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    dtUser.passwordResetAttempts = (dtUser.passwordResetAttempts || 0) + 1;
    await dtUser.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(
        dtUser.email, 
        dtUser.fullName, 
        resetToken, 
        'dtuser'
      );

      console.log(`🔐 Password reset token generated for DTUser: ${dtUser.email}`);

      res.status(200).json({
        success: true,
        message: 'Password reset link has been sent to your email address.',
        data: {
          email: dtUser.email,
          expiresIn: '1 hour'
        }
      });

    } catch (emailError) {
      // Clear reset token if email fails
      dtUser.passwordResetToken = null;
      dtUser.passwordResetExpires = null;
      await dtUser.save();

      console.error('❌ Failed to send reset email:', emailError);

      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email. Please try again later.'
      });
    }

  } catch (error) {
    console.error('❌ Error in DTUser forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing forgot password request',
      error: error.message
    });
  }
};

/**
 * Reset Password - Verify token and update password for DTUsers
 * POST /api/auth/dtuser-reset-password
 */
const dtUserResetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, password, and confirm password are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Hash the token to compare with database
    const hashedToken = hashToken(token);

    // Find DTUser with valid reset token
    const dtUser = await DTUser.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!dtUser) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update DTUser password and clear reset fields
    dtUser.password = hashedPassword;
    dtUser.hasSetPassword = true;
    dtUser.passwordResetToken = null;
    dtUser.passwordResetExpires = null;
    dtUser.passwordResetAttempts = 0;
    await dtUser.save();

    // Send confirmation email
    try {
      await sendPasswordResetConfirmationEmail(
        dtUser.email, 
        dtUser.fullName, 
        'dtuser'
      );
    } catch (emailError) {
      console.warn('⚠️ Failed to send confirmation email:', emailError);
      // Don't fail the password reset if confirmation email fails
    }

    console.log(`✅ Password successfully reset for DTUser: ${dtUser.email}`);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
      data: {
        email: dtUser.email,
        resetAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in DTUser reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing password reset',
      error: error.message
    });
  }
};

/**
 * Verify reset token validity (optional endpoint for frontend validation)
 * GET /api/auth/verify-reset-token/:token
 */
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { type } = req.query; // 'user' or 'dtuser'

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const hashedToken = hashToken(token);
    let user;

    if (type === 'dtuser') {
      user = await DTUser.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() }
      });
    } else {
      user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() }
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token is invalid or has expired'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        email: user.email,
        expiresAt: user.passwordResetExpires
      }
    });

  } catch (error) {
    console.error('❌ Error verifying reset token:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying token',
      error: error.message
    });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
  dtUserForgotPassword,
  dtUserResetPassword,
  verifyResetToken
};