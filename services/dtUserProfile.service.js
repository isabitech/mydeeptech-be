import dtUserRepository from '../repositories/dtUser.repository.js';
import { NotFoundError } from '../utils/responseHandler.js';
import bcrypt from 'bcrypt';

/**
 * Service handling user profile management.
 * Provides functionality to retrieve, update profiles and reset passwords.
 */
class DTUserProfileService {
    /**
     * Retrieves the user profile, excluding sensitive data like passwords.
     */
    async getProfile(userId) {
        // Retrieve full user record from storage
        const user = await dtUserRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Convert Mongoose document to plain object and sanitize sensitive fields
        const userObj = user.toObject();
        delete userObj.password;
        return userObj;
    }

    async updateProfile(userId, updateData) {
        // Execute atomic update in the repository
        const user = await dtUserRepository.update(userId, updateData);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Sanitize the updated user object before returning
        const userObj = user.toObject();
        delete userObj.password;
        return userObj;
    }

    /**
     * Resets a user's password after verifying the old password.
     */
    async resetPassword(userId, oldPassword, newPassword) {
        // Find existing user to verify current credentials
        const user = await dtUserRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Validate current password to authorize reset
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new Error("Invalid current password");
        }

        // Hash the new password and persist the change
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        return true;
    }
}

const dtUserProfileService = new DTUserProfileService();
export default dtUserProfileService;
