import userRepository from '../repositories/user.repository.js';
import dtUserRepository from '../repositories/dtUser.repository.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendPasswordResetEmail, sendPasswordResetConfirmationEmail } from '../utils/passwordResetMailer.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/responseHandler.js';

class PasswordResetService {
    /**
     * Generate secure random token for password reset
     */
    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Hash token for secure storage in database
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async forgotPassword(email, type = 'user') {
        if (!email) throw new ValidationError('Email is required');

        const repository = type === 'dtuser' ? dtUserRepository : userRepository;
        const user = await repository.findByEmail(email.toLowerCase());

        if (!user) {
            // Return a successful message even if user not found for security
            return { success: true, message: 'If an account with that email exists, we have sent a password reset link.' };
        }

        if (type === 'dtuser' && (!user.hasSetPassword || !user.password)) {
            throw new ValidationError('This account does not have a password set. Please complete your registration first.');
        }

        // Rate limiting check
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (user.passwordResetAttempts >= 5 && user.passwordResetExpires && user.passwordResetExpires > oneHourAgo) {
            throw new ValidationError('Too many password reset attempts. Please try again later.');
        }

        const resetToken = this.generateResetToken();
        const hashedToken = this.hashToken(resetToken);

        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
        await user.save();

        try {
            await sendPasswordResetEmail(
                user.email,
                type === 'dtuser' ? user.fullName : (user.firstname || user.username),
                resetToken,
                type
            );
            return { email: user.email, expiresIn: '1 hour' };
        } catch (error) {
            user.passwordResetToken = null;
            user.passwordResetExpires = null;
            await user.save();
            console.error(`❌ Failed to send reset email to ${user.email}:`, error);
            throw new Error('Failed to send reset email. Please try again later.');
        }
    }

    async resetPassword(token, password, confirmPassword, type = 'user') {
        if (!token || !password || !confirmPassword) {
            throw new ValidationError('Token, password, and confirm password are required');
        }

        if (password !== confirmPassword) {
            throw new ValidationError('Passwords do not match');
        }

        if (password.length < 8) {
            throw new ValidationError('Password must be at least 8 characters long');
        }

        const hashedToken = this.hashToken(token);
        const repository = type === 'dtuser' ? dtUserRepository : userRepository;

        const user = await repository.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }
        });

        if (!user) {
            throw new ValidationError('Password reset token is invalid or has expired');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        user.password = hashedPassword;
        if (type === 'dtuser') user.hasSetPassword = true;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        user.passwordResetAttempts = 0;
        await user.save();

        try {
            await sendPasswordResetConfirmationEmail(
                user.email,
                type === 'dtuser' ? user.fullName : (user.firstname || user.username),
                type
            );
        } catch (emailError) {
            console.warn(`⚠️ Failed to send reset confirmation to ${user.email}:`, emailError);
        }

        return { email: user.email, resetAt: new Date().toISOString() };
    }

    async verifyResetToken(token, type = 'user') {
        if (!token) throw new ValidationError('Token is required');

        const hashedToken = this.hashToken(token);
        const repository = type === 'dtuser' ? dtUserRepository : userRepository;

        const user = await repository.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }
        });

        if (!user) {
            throw new ValidationError('Token is invalid or has expired');
        }

        return {
            email: user.email,
            expiresAt: user.passwordResetExpires
        };
    }
}

export default new PasswordResetService();
