const User = require('../models/user');
const DTUser = require('../models/dtUser.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const MailService = require('./mail-service/mail-service');

const generateResetToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

class PasswordResetService {
    /**
     * Initiate password reset for a regular User
     */
    async forgotPassword(email) {
        const user = await User.findOne({ email: email.toLowerCase() });

        // Always respond the same to prevent email enumeration
        if (!user) return { message: 'If an account with that email exists, we have sent a password reset link.' };

        // Rate limit: max 5 attempts per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (user.passwordResetAttempts >= 5 && user.passwordResetExpires && user.passwordResetExpires > oneHourAgo) {
            throw { status: 429, message: 'Too many password reset attempts. Please try again later.' };
        }

        const resetToken = generateResetToken();
        user.passwordResetToken = hashToken(resetToken);
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
        await user.save();

        try {
            await MailService.sendPasswordResetEmailWithType(user.email, user.firstname || user.username, resetToken, 'user');
        } catch (emailError) {
            user.passwordResetToken = null;
            user.passwordResetExpires = null;
            await user.save();
            throw { status: 500, message: 'Failed to send reset email. Please try again later.' };
        }

        return { message: 'Password reset link has been sent to your email address.', data: { email: user.email, expiresIn: '1 hour' } };
    }

    /**
     * Complete password reset for a regular User
     */
    async resetPassword(token, password, confirmPassword) {
        if (!token || !password || !confirmPassword) throw { status: 400, message: 'Token, password, and confirm password are required' };
        if (password !== confirmPassword) throw { status: 400, message: 'Passwords do not match' };
        if (password.length < 8) throw { status: 400, message: 'Password must be at least 8 characters long' };

        const user = await User.findOne({ passwordResetToken: hashToken(token), passwordResetExpires: { $gt: new Date() } });
        if (!user) throw { status: 400, message: 'Password reset token is invalid or has expired' };

        user.password = await bcrypt.hash(password, 12);
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        user.passwordResetAttempts = 0;
        await user.save();

        try {
            await MailService.sendPasswordResetConfirmationEmail(user.email, user.firstname || user.username, 'user');
        } catch (e) { /* non-fatal */ }

        return { message: 'Password has been reset successfully. You can now log in with your new password.', data: { email: user.email, resetAt: new Date().toISOString() } };
    }

    /**
     * Initiate password reset for a DTUser
     */
    async dtUserForgotPassword(email) {
        const dtUser = await DTUser.findOne({ email: email.toLowerCase() });
        if (!dtUser) return { message: 'If an account with that email exists, we have sent a password reset link.' };

        if (!dtUser.hasSetPassword || !dtUser.password) {
            throw { status: 400, message: 'This account does not have a password set. Please complete your registration first.' };
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (dtUser.passwordResetAttempts >= 5 && dtUser.passwordResetExpires && dtUser.passwordResetExpires > oneHourAgo) {
            throw { status: 429, message: 'Too many password reset attempts. Please try again later.' };
        }

        const resetToken = generateResetToken();
        dtUser.passwordResetToken = hashToken(resetToken);
        dtUser.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        dtUser.passwordResetAttempts = (dtUser.passwordResetAttempts || 0) + 1;
        await dtUser.save();

        try {
            await MailService.sendPasswordResetEmailWithType(dtUser.email, dtUser.fullName, resetToken, 'dtuser');
        } catch (emailError) {
            dtUser.passwordResetToken = null;
            dtUser.passwordResetExpires = null;
            await dtUser.save();
            throw { status: 500, message: 'Failed to send reset email. Please try again later.' };
        }

        return { message: 'Password reset link has been sent to your email address.', data: { email: dtUser.email, expiresIn: '1 hour' } };
    }

    /**
     * Complete password reset for a DTUser
     */
    async dtUserResetPassword(token, password, confirmPassword) {
        if (!token || !password || !confirmPassword) throw { status: 400, message: 'Token, password, and confirm password are required' };
        if (password !== confirmPassword) throw { status: 400, message: 'Passwords do not match' };
        if (password.length < 8) throw { status: 400, message: 'Password must be at least 8 characters long' };

        const dtUser = await DTUser.findOne({ passwordResetToken: hashToken(token), passwordResetExpires: { $gt: new Date() } });
        if (!dtUser) throw { status: 400, message: 'Password reset token is invalid or has expired' };

        dtUser.password = await bcrypt.hash(password, 12);
        dtUser.hasSetPassword = true;
        dtUser.passwordResetToken = null;
        dtUser.passwordResetExpires = null;
        dtUser.passwordResetAttempts = 0;
        await dtUser.save();

        try {
            await MailService.sendPasswordResetConfirmationEmail(dtUser.email, dtUser.fullName, 'dtuser');
        } catch (e) { /* non-fatal */ }

        return { message: 'Password has been reset successfully. You can now log in with your new password.', data: { email: dtUser.email, resetAt: new Date().toISOString() } };
    }

    /**
     * Verify reset token validity
     */
    async verifyResetToken(token, type) {
        if (!token) throw { status: 400, message: 'Token is required' };

        const hashedToken = hashToken(token);
        const query = { passwordResetToken: hashedToken, passwordResetExpires: { $gt: new Date() } };
        const user = type === 'dtuser' ? await DTUser.findOne(query) : await User.findOne(query);

        if (!user) throw { status: 400, message: 'Token is invalid or has expired' };

        return { message: 'Token is valid', data: { email: user.email, expiresAt: user.passwordResetExpires } };
    }
}

module.exports = new PasswordResetService();
