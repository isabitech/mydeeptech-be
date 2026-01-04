import dtUserRepository from '../repositories/dtUser.repository.js';
import { NotFoundError } from '../utils/responseHandler.js';
import bcrypt from 'bcrypt';

class DTUserProfileService {
    async getProfile(userId) {
        const user = await dtUserRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Structure like current controller
        const userObj = user.toObject();
        delete userObj.password;
        return userObj;
    }

    async updateProfile(userId, updateData) {
        const user = await dtUserRepository.update(userId, updateData);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const userObj = user.toObject();
        delete userObj.password;
        return userObj;
    }

    async resetPassword(userId, oldPassword, newPassword) {
        const user = await dtUserRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        // This specific check would be in the service
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new Error("Invalid current password"); // Will be caught by errorHandler or specific handling
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        return true;
    }
}

const dtUserProfileService = new DTUserProfileService();
export default dtUserProfileService;
