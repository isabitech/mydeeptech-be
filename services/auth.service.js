import bcrypt from 'bcrypt';
import userRepository from '../repositories/user.repository.js';
import { AuthenticationError, ConflictError, NotFoundError } from '../utils/responseHandler.js';
import { RoleType } from '../utils/role.js';

/**
 * Generic authentication service for system users.
 * Handles account creation and credential verification.
 */
class AuthService {
    /**
     * Sign up a new user
     * @param {Object} userData 
     */
    async signup(userData) {
        const { email, password } = userData;

        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            throw new ConflictError('Email already in use');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await userRepository.create({
            ...userData,
            password: hashedPassword,
            role: RoleType.USER
        });

        const userResponse = newUser.toObject();
        delete userResponse.password;
        return userResponse;
    }

    /**
     * Authenticate a user
     * @param {string} email 
     * @param {string} password 
     */
    async login(email, password) {
        const user = await userRepository.findByEmail(email, true);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AuthenticationError('Invalid credentials');
        }

        const userResponse = user.toObject();
        delete userResponse.password;
        return userResponse;
    }
}

export default new AuthService();
