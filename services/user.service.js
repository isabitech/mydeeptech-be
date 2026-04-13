const DTUser = require('../models/dtUser.model');
const { signupSchema, loginSchema } = require('../utils/authValidator');
const { RoleType, getRolePermissionsWithDetails } = require('../utils/role');
const bcrypt = require('bcrypt');

class UserService {
    async signup(body) {
        const { error } = signupSchema.validate(body);
        if (error) throw { status: 400, message: error.details[0].message };

        const { firstname, lastname, username, email, password, phone } = body;

        const existingUser = await DTUser.findOne({ email });
        if (existingUser) throw { status: 400, message: 'Email already in use' };

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new DTUser({ firstname, lastname, username, email, password: hashedPassword, phone, role: RoleType.USER });
        await newUser.save();
        return newUser;
    }

    async login(body) {
        const { error } = loginSchema.validate(body);
        if (error) throw { status: 400, message: error.details[0].message };

        const { email, password } = body;
        const user = await DTUser.findOne({ email });
        if (!user) throw { status: 404, message: 'User not found' };

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) throw { status: 400, message: 'Invalid credentials' };

        const { password: _pw, ...rest } = user.toObject();
        return rest;
    }

    async getAllUsers(role) {
        const users = await DTUser.find({ role });
        return users;
    }

    async getUsers(query = {}) {
        const filter = {};
        if (query.role) filter.role = query.role.toUpperCase();

        const users = await DTUser.find(filter).select('-password');
        if (!users || users.length === 0) throw { status: 400, code: '99', message: 'No user found' };
        return users;
    }

    async getUserById(userId) {
        const user = await DTUser.findById(userId).select('-password');
        if (!user) throw { status: 404, code: '99', message: 'User not found' };
        return user;
    }

    getRoles() {
        return Object.keys(RoleType).map(key => ({
            id: key.toLowerCase(),
            name: RoleType[key].toLowerCase(),
            displayName: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase().replace('_', ' '),
            permissions: getRolePermissionsWithDetails(key),
            isEditable: RoleType[key] !== RoleType.ADMIN
        }));
    }

    async getRoleStatistics() {
        const stats = await DTUser.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
        const roleStats = {};
        Object.values(RoleType).forEach(role => { roleStats[role.toLowerCase()] = 0; });
        stats.forEach(stat => { roleStats[stat._id.toLowerCase()] = stat.count; });
        return roleStats;
    }
}

module.exports = new UserService();
