import passwordResetService from '../services/passwordReset.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
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
    const { error, value } = PasswordResetController.forgotPasswordSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    await passwordResetService.forgotPassword(value.email, 'user');
    ResponseHandler.success(res, null, 'If an account with that email exists, we have sent a password reset link.');
  }

  /**
   * Reset Password - Verify token and update password for regular users
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res) {
    const { error, value } = PasswordResetController.resetPasswordSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { token, password, confirmPassword } = value;
    await passwordResetService.resetPassword(token, password, confirmPassword, 'user');
    ResponseHandler.success(res, null, 'Password has been reset successfully. You can now log in.');
  }

  /**
   * Forgot Password - Send reset email for DTUsers
   * POST /api/dtuser/forgot-password
   */
  async dtUserForgotPassword(req, res) {
    const { error, value } = PasswordResetController.forgotPasswordSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    await passwordResetService.forgotPassword(value.email, 'dtuser');
    ResponseHandler.success(res, null, 'If an account with that email exists, we have sent a password reset link.');
  }

  /**
   * Reset Password - Verify token and update password for DTUsers
   * POST /api/dtuser/reset-password
   */
  async dtUserResetPassword(req, res) {
    const { error, value } = PasswordResetController.resetPasswordSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);
    const { token, password, confirmPassword } = value;
    await passwordResetService.resetPassword(token, password, confirmPassword, 'dtuser');
    ResponseHandler.success(res, null, 'Password has been reset successfully. You can now log in.');
  }

  /**
   * Verify reset token validity
   * GET /api/auth/verify-reset-token/:token
   */
  async verifyResetToken(req, res) {
    const { token } = req.params;
    const { type = 'user' } = req.query; // 'user' or 'dtuser'
    const data = await passwordResetService.verifyResetToken(token, type);
    ResponseHandler.success(res, data, 'Token is valid');
  }
}

export default new PasswordResetController();