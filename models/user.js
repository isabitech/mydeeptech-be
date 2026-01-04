import mongoose from 'mongoose';
import { RoleType } from '../utils/role.js';

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        minlength: 3,
        required: 'Firstname is required'
    },
    lastname: {
        type: String,
        minlength: 3,
        required: 'Lastname is required'
    },
    username: {
        type: String,
        minlength: 3,
        required: 'Username is required'
    },
    email: {
        type: String,
        minlength: 3,
        unique: true,
        lowercase: true,
        required: "Email is required"
    },
    password: {
        type: String,
        minlength: 8,
        required: "Password is required",
        select: false
    },
    phone: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: "Role name is required",
        enum: Object.values(RoleType),
        default: RoleType.USER
    },
    // Password reset fields
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    },
    passwordResetAttempts: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;