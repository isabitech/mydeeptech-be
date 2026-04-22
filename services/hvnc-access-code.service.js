const HVNCAccessCodeRepository = require('../repositories/hvnc-access-code.repository');
const HVNCDeviceRepository = require('../repositories/hvnc-device.repository');
const HVNCUserRepository = require('../repositories/hvnc-user.repository');
const HVNCShiftRepository = require('../repositories/hvnc-shift.repository');
const HVNCSessionRepository = require('../repositories/hvnc-session.repository');
const HVNCCommandRepository = require('../repositories/hvnc-command.repository');
const HVNCActivityLogRepository = require('../repositories/hvnc-activity-log.repository');
const emailService = require('./hvnc-email.service');
const hvncVerificationStore = require('../utils/hvncVerificationStore');
const { sendCommandToDevice } = require('./hvnc-websocket.service');

class HVNCAccessCodeService {
    async validateCode(codeData, context = {}) {
        const startTime = Date.now();
        const { email, code, device_id, request_time } = codeData;
        const { userAgent, originalIp } = context;

        // Find user
        const user = await HVNCUserRepository.findByEmail(email);
        if (!user) {
            await HVNCActivityLogRepository.create({
                event_type: 'security',
                event_name: 'authentication_failed',
                user_email: email,
                device_id,
                details: { reason: 'user_not_found' },
                metadata: { ip_address: originalIp, user_agent: userAgent, severity: 'medium' }
            });
            throw { status: 401, code: 'USER_NOT_FOUND', message: 'Invalid credentials' };
        }

        // Validate via Redis
        const validationResult = await hvncVerificationStore.validateCode(email, device_id, code);
        if (!validationResult.valid) {
            await user.recordFailedLogin();
            await HVNCActivityLogRepository.create({
                event_type: 'security',
                event_name: 'authentication_failed',
                user_email: email,
                device_id,
                details: { 
                    reason: validationResult.reason, 
                    message: validationResult.message,
                    attempts_remaining: validationResult.attemptsRemaining 
                },
                metadata: { ip_address: originalIp, user_agent: userAgent, severity: 'high' }
            });
            throw { 
                status: 401, 
                code: validationResult.reason, 
                message: validationResult.message,
                attempts_remaining: validationResult.attemptsRemaining 
            };
        }

        // Resolve device
        const device = await HVNCDeviceRepository.findByDeviceId(device_id);
        if (!device) {
            throw { status: 401, code: 'DEVICE_NOT_FOUND', message: 'Device not found' };
        }

        // Check shift
        const now = request_time ? new Date(request_time) : new Date();
        const isAllowed = await HVNCShiftRepository.isUserAllowedAccess(email, device.device_id, now);
        if (!isAllowed) {
            await HVNCActivityLogRepository.create({
                event_type: 'security',
                event_name: 'authentication_failed',
                user_email: email,
                device_id: device.device_id,
                details: { reason: 'outside_shift_hours', attempted_time: now },
                metadata: { ip_address: originalIp, user_agent: userAgent, severity: 'low' }
            });
            throw { status: 401, code: 'OUTSIDE_SHIFT', message: 'Access not allowed outside shift hours' };
        }

        // Create session
        const session = await HVNCSessionRepository.create({
            session_id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            device_id: device.device_id,
            user_email: email.toLowerCase(),
            started_at: new Date(),
            ip_address: originalIp,
            status: 'active'
        });

        // Dispatch command
        const command = await HVNCCommandRepository.create({
            device_id: device.device_id,
            session_id: session.session_id,
            user_email: email,
            type: 'session',
            action: 'start_session',
            payload: {
                session_id: session.session_id,
                user_email: email,
                user_name: user.fullName,
                ip_address: originalIp
            },
            priority: 'high'
        });

        try {
            await sendCommandToDevice(device.device_id, command);
            command.status = 'sent';
            command.sent_at = new Date();
            await command.save();
        } catch (wsError) {
            console.log(`📋 Device ${device.device_id} not connected via WS, command queued`);
        }

        // Update user
        await HVNCUserRepository.updateLastLogin(user._id, originalIp);

        // Get current shift
        const currentShift = await HVNCShiftRepository.findCurrentActiveShift(email, device.device_id);

        return {
            valid: true,
            session: {
                session_id: session.session_id,
                user: { email: user.email, name: user.fullName, role: user.role },
                expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
                permissions: user.permissions
            },
            shift: currentShift ? {
                start_time: currentShift.start_time,
                end_time: currentShift.end_time,
                timezone: currentShift.timezone,
                remaining_minutes: currentShift.getRemainingTime()
            } : null
        };
    }

    async requestCode(requestData, context = {}) {
        const { email, device_id } = requestData;
        const { originalIp, userAgent } = context;

        const user = await HVNCUserRepository.findByEmail(email);
        if (!user) {
            // Anti-enumeration
            return { success: true, message: 'If the email exists, an access code has been sent' };
        }

        const device = await HVNCDeviceRepository.findByDeviceId(device_id);
        if (!device || device.status === 'disabled') {
            throw { status: 400, code: device ? 'DEVICE_DISABLED' : 'DEVICE_NOT_FOUND', message: device ? 'Device is disabled' : 'Device not found' };
        }

        const shifts = await HVNCShiftRepository.findActiveShiftsForUser(email, device.device_id);
        if (shifts.length === 0) {
            throw { status: 403, code: 'NO_SHIFTS', message: 'No active shifts found for this device' };
        }

        await hvncVerificationStore.removeAccessCode(email, device_id);
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await hvncVerificationStore.setAccessCode(email, device_id, code, {
            userId: user._id,
            email: user.email,
            deviceId: device_id,
            purpose: 'hvnc_access'
        });

        try {
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await emailService.sendAccessCode(user, device, code, expiresAt);
        } catch (emailError) {
            await hvncVerificationStore.removeAccessCode(email, device_id);
            throw { status: 500, code: 'EMAIL_ERROR', message: 'Failed to send access code' };
        }

        return { success: true, message: 'Access code sent to your email', expires_in: 900 };
    }

    async generateAdminCode(adminData, context = {}) {
        const { email, device_id, expires_in_hours = 24, max_uses = 1, send_email = false } = adminData;
        const { adminUser, originalIp } = context;

        const user = await HVNCUserRepository.findByEmail(email);
        if (!user) throw { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' };

        const device = await HVNCDeviceRepository.findByDeviceId(device_id);
        if (!device) throw { status: 404, code: 'DEVICE_NOT_FOUND', message: 'Device not found' };

        const accessCode = await HVNCAccessCodeRepository.create({
            user_email: email.toLowerCase(),
            device_id: device.device_id,
            max_uses,
            expires_at: new Date(Date.now() + expires_in_hours * 3600000),
            created_by_ip: originalIp
        });

        // The repository might need to generate the 8-char code. 
        // For now let's assume it's handled or we do it here.
        const code = Math.random().toString(36).substr(2, 8).toUpperCase();
        accessCode.code_hash = await accessCode.hashSecondaryCode(code);
        await accessCode.save();

        if (send_email) {
            try {
                await emailService.sendAccessCode(user, device, code, accessCode.expires_at);
                accessCode.email_sent = true;
                await accessCode.save();
            } catch (e) { console.warn('Email failed'); }
        }

        return {
            success: true,
            access_code: {
                id: accessCode._id,
                code: context.return_code ? code : undefined,
                expires_at: accessCode.expires_at,
                max_uses: accessCode.max_uses,
                email_sent: accessCode.email_sent
            },
            user: {
                email: user.email,
                name: user.fullName
            },
            device: {
                device_id: device.device_id,
                name: device.pc_name
            }
        };
    }

    async listCodes(filters, pagination) {
        const { email, device_id, status } = filters;
        const { page, limit } = pagination;
        const query = {};
        
        if (email) query.user_email = email.toLowerCase();
        if (device_id) query.device_id = device_id;
        
        if (status === 'active') {
            query.is_active = true;
            query.expires_at = { $gt: new Date() };
        } else if (status === 'expired') {
            query.expires_at = { $lt: new Date() };
        } else if (status === 'inactive') {
            query.is_active = false;
        }

        const skip = (page - 1) * limit;
        
        const codes = await HVNCAccessCodeRepository.findPaginated(query, skip, limit);
        const total = await HVNCAccessCodeRepository.countDocuments(query);

        return {
            codes: codes.map(code => ({
                id: code._id,
                user_email: code.user_email,
                device_id: code.device_id,
                created_at: code.createdAt,
                expires_at: code.expires_at,
                max_uses: code.max_uses,
                used_count: code.used_count,
                is_active: code.is_active,
                is_valid: code.is_valid,
                email_sent: code.email_sent,
                usage_logs: code.usage_logs
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async revokeCode(code_id, reason, context = {}) {
        const { adminUser, originalIp, userAgent } = context;

        const accessCode = await HVNCAccessCodeRepository.findById(code_id);
        if (!accessCode) {
            throw { status: 404, code: 'CODE_NOT_FOUND', message: 'Access code not found' };
        }

        await accessCode.deactivate(reason);

        // We use HVNCActivityLogRepository here inline for logUserEvent
        await HVNCActivityLogRepository.create({
            event_type: 'user',
            event_name: 'admin_action',
            user_email: adminUser.email,
            device_id: accessCode.device_id,
            details: {
                action: 'revoke_access_code',
                code_id: accessCode._id,
                target_user: accessCode.user_email,
                reason
            },
            metadata: {
                ip_address: originalIp,
                user_agent: userAgent,
                status: 'success'
            }
        });

        return {
            success: true,
            message: 'Access code revoked successfully',
            code_id: accessCode._id
        };
    }
}

module.exports = new HVNCAccessCodeService();
