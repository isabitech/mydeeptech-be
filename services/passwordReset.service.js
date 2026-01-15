import userRepository from '../repositories/user.repository.js';
import dtUserRepository from '../repositories/dtUser.repository.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendPasswordResetEmail, sendPasswordResetConfirmationEmail } from '../utils/passwordResetMailer.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/responseHandler.js';

/**
 * Service managing the password recovery lifecycle.
 * Implements secure token generation, hashing, and automated email notifications for DTUsers and system users.
 */
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

    /**
     * Initiates the password reset process by generating a secure token and sending an email.
     * Implements rate limiting and security measures (generic response for non-existent users).
     */
    async forgotPassword(email, type = 'user') {
        if (!email) throw new ValidationError('Email is required');

        // Dynamically select the repository based on user type (System User vs DTUser/Annotator)
        const repository = type === 'dtuser' ? dtUserRepository : userRepository;
        const user = await repository.findByEmail(email.toLowerCase());

        // Security best practice: return generic success even if user record doesn't exist
        if (!user) {
            return { success: true, message: 'If an account with that email exists, we have sent a password reset link.' };
        }

        // Ensure users haven't bypassed initialization flows
        if (type === 'dtuser' && (!user.hasSetPassword || !user.password)) {
            throw new ValidationError('This account does not have a password set. Please complete your registration first.');
        }

        // Enforce rate limiting to prevent reset token spamming/enumeration
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (user.passwordResetAttempts >= 5 && user.passwordResetExpires && user.passwordResetExpires > oneHourAgo) {
            throw new ValidationError('Too many password reset attempts. Please try again later.');
        }

        // Generate and securely hash a one-time reset token
        const resetToken = this.generateResetToken();
        const hashedToken = this.hashToken(resetToken);

        // Persist the hashed token and set a strict 1-hour expiration window
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
        await user.save();

        // Dispatch the sensitive reset link via email
        try {
            await sendPasswordResetEmail(
                user.email,
                type === 'dtuser' ? user.fullName : (user.firstname || user.username),
                resetToken,
                type
            );
            return { email: user.email, expiresIn: '1 hour' };
        } catch (error) {
            // Rollback token changes on failure to maintain accurate state
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

        // Basic validation for consistency and security policy
        if (password !== confirmPassword) {
            throw new ValidationError('Passwords do not match');
        }

        if (password.length < 8) {
            throw new ValidationError('Password must be at least 8 characters long');
        }

        // Re-hash the provided token to find the matching user record
        const hashedToken = this.hashToken(token);
        const repository = type === 'dtuser' ? dtUserRepository : userRepository;

        // Verify the token's existence and that it hasn't passed its expiration window
        const user = await repository.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }
        });

        if (!user) {
            throw new ValidationError('Password reset token is invalid or has expired');
        }

        // Securely hash the new password and clear the reset metadata
        const hashedPassword = await bcrypt.hash(password, 12);
        user.password = hashedPassword;
        if (type === 'dtuser') user.hasSetPassword = true;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        user.passwordResetAttempts = 0;
        await user.save();

        // Send a security alert notifying the user that their password was changed
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

        // Verify the token validity before allowing the user to view the reset form
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
