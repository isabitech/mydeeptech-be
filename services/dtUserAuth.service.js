import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dtUserRepository from '../repositories/dtUser.repository.js';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '../utils/responseHandler.js';
import { sendVerificationEmail } from '../utils/mailer.js';
import adminVerificationStore from "../utils/adminVerificationStore.js";
import { sendAdminVerificationEmail } from "../utils/adminMailer.js";

/**
 * Service handling authentication logic for Deep Tech Users (DTUsers).
 * Includes registration, login, email verification, and admin account management.
 */
class DTUserAuthService {
    /**
     * Registers a new user and sends a verification email.
     * @param {Object} userData - User registration data
     * @returns {Object} The created user
     */
    async register(userData) {
        const { email } = userData;

        // Check if user already exists to prevent duplicates
        const existing = await dtUserRepository.findByEmail(email);
        if (existing) {
            throw new ConflictError("User already exists with this email");
        }

        // Create new user record in the database
        const newUser = await dtUserRepository.create(userData);

        // Trigger asynchronous email verification process
        try {
            await sendVerificationEmail(newUser.email, newUser.fullName, newUser._id);
        } catch (emailError) {
            console.error("❌ Email sending failed:", emailError.message);
            // Non-blocking error: user is still registered even if email fails
        }

        return newUser;
    }

    /**
     * Authenticates a user and generates a JWT.
     * @param {string} email - User email
     * @param {string} password - plain text password
     * @returns {Object} Object containing JWT token and user details
     */
    async login(email, password) {
        // Find user by email to begin authentication
        const user = await dtUserRepository.findByEmail(email);
        if (!user) {
            throw new AuthenticationError("Invalid credentials");
        }

        // Enforce email verification before allowing access
        if (!user.isEmailVerified) {
            throw new AuthenticationError("Please verify your email first");
        }

        // Check if user has completed the mandatory password setup flow
        if (!user.hasSetPassword) {
            // Specialized error for frontend to handle password setup redirect
            const error = new AuthenticationError("Please set up your password first");
            error.details = { userId: user._id, requiresPasswordSetup: true };
            throw error;
        }

        // Verify the provided password against the stored hash
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AuthenticationError("Invalid credentials");
        }

        // Generate a long-lived JWT for the session
        const token = jwt.sign(
            { userId: user._id, email: user.email, fullName: user.fullName },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Prepare clean user object for the client (omit sensitive hash)
        const userObj = user.toObject();
        delete userObj.password;

        return { token, user: userObj };
    }

    /**
     * Verifies a user's email address.
     * @param {string} id - User ID
     * @returns {Object} Updated user object
     */
    async verifyEmail(id) {
        // Retrieve user to verify their existence
        const user = await dtUserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Skip update if already verified to avoid redundant writes
        if (user.isEmailVerified) {
            return user;
        }

        // Mark as verified and persist change
        user.isEmailVerified = true;
        await user.save();
        return user;
    }

    async setupPassword(id, password) {
        const user = await dtUserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.hasSetPassword = true;
        await user.save();

        return user;
    }

    /**
     * Initiates the registration process for administrative accounts.
     * Checks email domain against whitelist and sends a verification code.
     */
    async requestAdminVerification(adminData, adminKey) {
        // Validate the secret key required for admin registration attempts
        const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
        if (adminKey !== validAdminKey) throw new AuthenticationError("Invalid admin creation key");

        // Verify that the email is authorized for admin access (domain check)
        const { email } = adminData;
        const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
        const isValid = email.toLowerCase().endsWith('@mydeeptech.ng') || adminEmails.includes(email.toLowerCase());
        if (!isValid) throw new ValidationError("Invalid admin email domain");

        // Prevent duplicate admin account creation
        const existing = await dtUserRepository.findByEmail(email);
        if (existing) throw new ConflictError("Admin account already exists");

        // Generate and store a secure 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        await adminVerificationStore.setVerificationCode(email, verificationCode, adminData);

        // Dispatch verification code via email
        await sendAdminVerificationEmail(email, verificationCode, adminData.fullName);

        return { email, expiresIn: "15 minutes" };
    }

    /**
     * Confirms admin registration using the verification code and creates the admin account.
     */
    async confirmAdminVerification(email, verificationCode, adminKey) {
        const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
        if (adminKey !== validAdminKey) throw new AuthenticationError("Invalid admin creation key");

        const verificationData = await adminVerificationStore.getVerificationData(email);
        if (!verificationData) throw new NotFoundError("Verification request not found or expired");

        if (verificationCode !== verificationData.code) {
            await adminVerificationStore.incrementAttempts(email);
            throw new ValidationError("Invalid verification code");
        }

        const { fullName, phone, password } = verificationData.adminData;
        const hashedPassword = await bcrypt.hash(password, 12);

        const newAdmin = await dtUserRepository.create({
            fullName, phone, email: email.toLowerCase(),
            domains: ['Administration', 'Management'],
            password: hashedPassword,
            hasSetPassword: true,
            isEmailVerified: false,
            annotatorStatus: 'approved',
            microTaskerStatus: 'approved'
        });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await adminVerificationStore.setVerificationCode(newAdmin.email, otpCode, {
            userId: newAdmin._id, fullName: newAdmin.fullName, email: newAdmin.email, purpose: 'email_verification'
        });

        await sendAdminVerificationEmail(newAdmin.email, otpCode, newAdmin.fullName);

        await adminVerificationStore.removeVerificationCode(email);
        return newAdmin;
    }

    async adminLogin(email, password) {
        const user = await dtUserRepository.findByEmail(email);
        if (!user) throw new AuthenticationError("Invalid credentials");

        const isAdmin = user.domains.some(d => ['Administration', 'Management'].includes(d)) || user.email.endsWith('@mydeeptech.ng');
        if (!isAdmin) throw new AuthenticationError("Unauthorized access");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new AuthenticationError("Invalid credentials");

        if (!user.isEmailVerified) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            await adminVerificationStore.setVerificationCode(user.email, otpCode, {
                userId: user._id, fullName: user.fullName, email: user.email, purpose: 'admin_login'
            });
            await sendAdminVerificationEmail(user.email, otpCode, user.fullName);
            throw new AuthenticationError("OTP verification required", { otpRequired: true });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return { token, admin: user };
    }

    async verifyAdminOTP(email, code, adminKey) {
        const validAdminKey = process.env.ADMIN_CREATION_KEY || 'super-secret-admin-key-2024';
        if (adminKey !== validAdminKey) throw new AuthenticationError("Invalid admin key");

        const verificationData = await adminVerificationStore.getVerificationData(email);
        if (!verificationData || verificationData.code !== code) throw new ValidationError("Invalid or expired OTP");

        const user = await dtUserRepository.findById(verificationData.adminData.userId);
        if (!user) throw new NotFoundError("Admin not found");

        user.isEmailVerified = true;
        await user.save();
        await adminVerificationStore.removeVerificationCode(email);

        const token = jwt.sign(
            { userId: user._id, email: user.email, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return { token, admin: user };
    }

    async resendVerificationEmail(email) {
        const user = await dtUserRepository.findByEmail(email);
        if (!user) throw new NotFoundError("User not found");
        if (user.isEmailVerified) throw new ValidationError("Email is already verified");

        try {
            await sendVerificationEmail(user.email, user.fullName, user._id);
            return { email, sent: true };
        } catch (error) {
            console.error(`❌ Failed to resend verification email to ${email}:`, error.message);
            throw new Error("Failed to send verification email. Please try again later.");
        }
    }
}

const dtUserAuthService = new DTUserAuthService();
export default dtUserAuthService;
