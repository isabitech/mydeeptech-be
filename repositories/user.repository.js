import User from '../models/user.js';

class UserRepository {
    /**
     * Find a user by email
     * @param {string} email 
     * @param {boolean} includePassword - Whether to include the password field (hidden by default)
     */
    async findByEmail(email, includePassword = false) {
        const query = User.findOne({ email });
        if (includePassword) {
            query.select('+password');
        }
        return await query.exec();
    }

    /**
     * Find a user by ID
     * @param {string} id 
     */
    async findById(id) {
        return await User.findById(id).exec();
    }

    /**
     * Find users by filter
     * @param {Object} filter 
     */
    async find(filter = {}) {
        return await User.find(filter).exec();
    }

    /**
     * Create a new user
     * @param {Object} userData 
     */
    async create(userData) {
        const user = new User(userData);
        return await user.save();
    }

    /**
     * Find one user by filter
     * @param {Object} filter 
     */
    async findOne(filter) {
        return await User.findOne(filter).exec();
    }

    /**
     * Generic save method for a document
     * @param {Document} userDoc 
     */
    async save(userDoc) {
        return await userDoc.save();
    }
}

export default new UserRepository();
