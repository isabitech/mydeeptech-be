import passwordResetService from '../services/passwordReset.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';

class PasswordResetController {
  // SCHEMAS
  static forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required().lowercase().trim()
  });

  static resetPasswordSchema = Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match'
    })
  });

  /**
   * Forgot Password - Send reset email for regular users
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res) {
    try {
      const { error, value } = PasswordResetController.forgotPasswordSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      await passwordResetService.forgotPassword(value.email, 'user');
      return ResponseHandler.success(res, null, 'If an account with that email exists, we have sent a password reset link.');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Reset Password - Verify token and update password for regular users
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res) {
    try {
      const { error, value } = PasswordResetController.resetPasswordSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const { token, password, confirmPassword } = value;
      await passwordResetService.resetPassword(token, password, confirmPassword, 'user');
      return ResponseHandler.success(res, null, 'Password has been reset successfully. You can now log in.');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Forgot Password - Send reset email for DTUsers
   * POST /api/dtuser/forgot-password
   */
  async dtUserForgotPassword(req, res) {
    try {
      const { error, value } = PasswordResetController.forgotPasswordSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      await passwordResetService.forgotPassword(value.email, 'dtuser');
      return ResponseHandler.success(res, null, 'If an account with that email exists, we have sent a password reset link.');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Reset Password - Verify token and update password for DTUsers
   * POST /api/dtuser/reset-password
   */
  async dtUserResetPassword(req, res) {
    try {
      const { error, value } = PasswordResetController.resetPasswordSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const { token, password, confirmPassword } = value;
      await passwordResetService.resetPassword(token, password, confirmPassword, 'dtuser');
      return ResponseHandler.success(res, null, 'Password has been reset successfully. You can now log in.');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }

  /**
   * Verify reset token validity
   * GET /api/auth/verify-reset-token/:token
   */
  async verifyResetToken(req, res) {
    try {
      const { token } = req.params;
      const { type = 'user' } = req.query; // 'user' or 'dtuser'
      const data = await passwordResetService.verifyResetToken(token, type);
      return ResponseHandler.success(res, data, 'Token is valid');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new PasswordResetController();