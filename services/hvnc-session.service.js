const HVNCSessionRepository = require('../repositories/hvnc-session.repository');
const HVNCDeviceRepository = require('../repositories/hvnc-device.repository');
const HVNCUserRepository = require('../repositories/hvnc-user.repository');
const HVNCActivityLogRepository = require('../repositories/hvnc-activity-log.repository');
const HVNCCommandRepository = require('../repositories/hvnc-command.repository');
const emailService = require('./hvnc-email.service');

class HVNCSessionService {
    async startSession(device, sessionData, context = {}) {
        const startTime = Date.now();
        const { session_id, user_email, started_at, ip_address } = sessionData;
        const { userAgent, originalIp } = context;

        // Check if user exists and is active
        const user = await HVNCUserRepository.findByEmail(user_email);
        if (!user || user.is_account_locked) {
            await HVNCActivityLogRepository.create({
                event_type: 'security',
                event_name: 'session_start_failed',
                session_id,
                user_email,
                device_id: device.device_id,
                details: {
                    reason: user ? 'account_locked' : 'user_not_found',
                    ip_address: ip_address || originalIp
                },
                metadata: {
                    ip_address: ip_address || originalIp,
                    user_agent: userAgent,
                    severity: 'medium'
                }
            });

            throw {
                status: 401,
                code: user ? 'ACCOUNT_LOCKED' : 'USER_NOT_FOUND',
                message: user ? 'User account is locked' : 'User not found or inactive'
            };
        }

        // Check if session already exists
        const existingSession = await HVNCSessionRepository.findById(session_id);
        if (existingSession) {
            throw {
                status: 409,
                code: 'SESSION_EXISTS',
                message: 'Session already exists'
            };
        }

        // Create new session
        const session = await HVNCSessionRepository.create({
            session_id,
            device_id: device.device_id,
            user_email: user_email.toLowerCase(),
            started_at: started_at ? new Date(started_at) : new Date(),
            ip_address: ip_address || originalIp,
            status: 'active'
        });

        // Update device status
        await HVNCDeviceRepository.updateStatus(device.device_id, 'online');

        // Log session start
        await HVNCActivityLogRepository.create({
            event_type: 'session',
            event_name: 'session_started',
            session_id,
            user_email,
            device_id: device.device_id,
            details: {
                device_name: device.pc_name,
                ip_address: ip_address || originalIp
            },
            metadata: {
                user_email,
                device_id: device.device_id,
                ip_address: ip_address || originalIp,
                user_agent: userAgent,
                status: 'success',
                duration_ms: Date.now() - startTime
            }
        });

        // Send session started notification
        if (user.preferences?.notify_session_start || user.shift_preferences?.notification_email) {
            try {
                await emailService.sendSessionStartedNotification(user, device, session);
            } catch (emailError) {
                console.warn('Failed to send session started notification:', emailError);
            }
        }

        return {
            session_id: session.session_id,
            max_duration_hours: session.settings?.max_duration_hours || 8,
            idle_timeout_minutes: session.settings?.idle_timeout_minutes || 30,
            started_at: session.started_at
        };
    }

    async endSession(session_id, endData, context = {}) {
        const startTime = Date.now();
        const { reason = 'user_logout', duration_minutes } = endData;
        const { userAgent, originalIp } = context;

        const session = await HVNCSessionRepository.findById(session_id);
        if (!session) {
            throw {
                status: 404,
                code: 'SESSION_NOT_FOUND',
                message: 'Session not found'
            };
        }

        if (session.status === 'ended') {
            throw {
                status: 400,
                code: 'SESSION_ALREADY_ENDED',
                message: 'Session already ended'
            };
        }

        // Use model method to end session
        await session.endSession(reason);

        // Update override duration if provided
        if (duration_minutes) {
            session.duration_minutes = duration_minutes;
            await session.save();
        }

        // Cancel pending commands for this specific session
        await HVNCCommandRepository.cancelPendingBySession(session_id, reason);

        // Get user and device for notification
        const user = await HVNCUserRepository.findByEmail(session.user_email);
        const device = await HVNCDeviceRepository.findByDeviceId(session.device_id);

        // Log session end
        await HVNCActivityLogRepository.create({
            event_type: 'session',
            event_name: 'session_ended',
            session_id,
            user_email: session.user_email,
            device_id: session.device_id,
            details: {
                duration_minutes: session.duration_minutes,
                end_reason: reason,
                commands_executed: session.commands_executed
            },
            metadata: {
                user_email: session.user_email,
                device_id: session.device_id,
                ip_address: originalIp,
                user_agent: userAgent,
                status: 'success',
                duration_ms: Date.now() - startTime
            }
        });

        // Send notification
        if (user?.preferences?.notify_session_end || user?.shift_preferences?.notification_email) {
            try {
                await emailService.sendSessionEndedNotification(user, device, session);
            } catch (emailError) {
                console.warn('Failed to send session ended notification:', emailError);
            }
        }

        return {
            session_id: session.session_id,
            ended_at: session.ended_at,
            duration_minutes: session.duration_minutes,
            end_reason: session.end_reason
        };
    }

    async updateActivity(session_id, activityData) {
        const { last_activity, activity_type = 'general' } = activityData;

        const session = await HVNCSessionRepository.findById(session_id);
        if (!session || !['active', 'idle'].includes(session.status)) {
            throw {
                status: 404,
                code: 'SESSION_NOT_FOUND',
                message: 'Active session not found'
            };
        }

        if (session.is_timed_out) {
            await session.endSession('idle_timeout');
            throw {
                status: 410,
                code: 'SESSION_TIMEOUT',
                message: 'Session has timed out'
            };
        }

        await session.updateActivity(activity_type);

        if (last_activity) {
            session.last_activity = new Date(last_activity);
            await session.save();
        }

        return {
            session_id: session.session_id,
            last_activity: session.last_activity,
            status: session.status,
            current_duration_minutes: session.current_duration_minutes
        };
    }

    async getSessionDetails(session_id) {
        const HVNCSession = require('../models/hvnc-session.model');
        const session = await HVNCSession.findOne({ session_id })
            .populate('user_email', 'email full_name role')
            .populate('device_id', 'device_id pc_name hostname status');

        if (!session) {
            throw {
                status: 404,
                code: 'SESSION_NOT_FOUND',
                message: 'Session not found'
            };
        }

        const activeCommands = await HVNCCommandRepository.findActiveBySessionId(session_id);

        return {
            session: {
                session_id: session.session_id,
                user_email: session.user_email,
                device_id: session.device_id,
                started_at: session.started_at,
                ended_at: session.ended_at,
                duration_minutes: session.duration_minutes || session.current_duration_minutes,
                last_activity: session.last_activity,
                status: session.status,
                end_reason: session.end_reason,
                ip_address: session.ip_address,
                is_active: session.is_active,
                is_timed_out: session.is_timed_out,
                commands_executed: session.commands_executed,
                chrome_interactions: session.chrome_interactions,
                keyboard_events: session.keyboard_events,
                mouse_events: session.mouse_events,
                hubstaff_session: session.hubstaff_session,
                settings: session.settings,
                connection_quality: session.connection_quality
            },
            active_commands: activeCommands.map(cmd => ({
                id: cmd.command_id,
                type: cmd.type,
                action: cmd.action,
                status: cmd.status,
                created_at: cmd.createdAt,
                expires_at: cmd.expires_at
            }))
        };
    }

    async getActiveSessions(filters) {
        const { device_id, user_email, limit = 50 } = filters;
        
        const query = {
            status: { $in: ['active', 'idle'] },
            ended_at: { $exists: false }
        };

        if (device_id) query.device_id = device_id;
        if (user_email) query.user_email = user_email.toLowerCase();

        const HVNCSession = require('../models/hvnc-session.model');
        const sessions = await HVNCSession.find(query)
            .sort({ started_at: -1 })
            .limit(parseInt(limit))
            .populate('user_email', 'email full_name role')
            .populate('device_id', 'device_id pc_name hostname status');
        
        // Include session statistics
        const stats = {
            total_active: sessions.length,
            by_status: {},
            by_device: {},
            total_duration_minutes: 0
        };

        sessions.forEach(session => {
            stats.by_status[session.status] = (stats.by_status[session.status] || 0) + 1;
            const deviceId = session.device_id?.device_id || 'unknown';
            stats.by_device[deviceId] = (stats.by_device[deviceId] || 0) + 1;
            stats.total_duration_minutes += session.current_duration_minutes || 0;
        });

        return {
            sessions: sessions.map(session => ({
                session_id: session.session_id,
                user_email: session.user_email,
                device_id: session.device_id,
                started_at: session.started_at,
                last_activity: session.last_activity,
                status: session.status,
                current_duration_minutes: session.current_duration_minutes,
                is_timed_out: session.is_timed_out,
                commands_executed: session.commands_executed,
                ip_address: session.ip_address
            })),
            stats
        };
    }

    async forceEndSession(session_id, forceEndData, context = {}) {
        const { reason = 'admin_disconnect', notify_user = true } = forceEndData;
        const { adminUser, originalIp, userAgent } = context;

        const session = await HVNCSessionRepository.findById(session_id);
        if (!session) {
            throw {
                status: 404,
                code: 'SESSION_NOT_FOUND',
                message: 'Session not found'
            };
        }

        if (session.status === 'ended') {
            throw {
                status: 400,
                code: 'SESSION_ALREADY_ENDED',
                message: 'Session already ended'
            };
        }

        await session.endSession(reason);

        // Cancel pending commands for this specific session
        await HVNCCommandRepository.cancelPendingBySession(session_id, reason);

        // Log admin action
        await HVNCActivityLogRepository.create({
            event_type: 'user',
            event_name: 'admin_action',
            user_email: adminUser.email,
            details: {
                action: 'force_end_session',
                session_id: session.session_id,
                target_user: session.user_email,
                device_id: session.device_id,
                reason,
                original_duration: session.current_duration_minutes
            },
            metadata: {
                ip_address: originalIp,
                user_agent: userAgent,
                status: 'success'
            }
        });

        // Notify user if requested
        if (notify_user) {
            try {
                const user = await HVNCUserRepository.findByEmail(session.user_email);
                const device = await HVNCDeviceRepository.findByDeviceId(session.device_id);
                
                if (user) {
                    await emailService.sendSecurityAlert(user, device, {
                        type: 'Session Force-Ended',
                        message: `Your session was terminated by an administrator. Reason: ${reason}`,
                        severity: 'medium',
                        timestamp: new Date(),
                        ip_address: originalIp
                    });
                }
            } catch (emailError) {
                console.warn('Failed to send force-end notification:', emailError);
            }
        }

        return {
            session_id: session.session_id,
            ended_at: session.ended_at,
            duration_minutes: session.duration_minutes,
            end_reason: session.end_reason
        };
    }

    async cleanupSessions(context = {}) {
        const { originalIp } = context;
        // This logic is mostly in the model, but we can wrap it.
        const HVNCSession = require('../models/hvnc-session.model');
        const timedOutSessions = await HVNCSession.endTimedOutSessions();
        
        // Log cleanup activity
        await HVNCActivityLogRepository.create({
            event_type: 'user',
            event_name: 'system_maintenance',
            user_email: 'system',
            details: {
                action: 'session_cleanup',
                sessions_cleaned: timedOutSessions.length,
                session_ids: timedOutSessions.map(s => s.session_id)
            },
            metadata: {
                status: 'success',
                ip_address: originalIp
            }
        });

        return {
            message: 'Session cleanup completed',
            sessions_cleaned: timedOutSessions.length,
            cleaned_sessions: timedOutSessions.map(session => ({
                session_id: session.session_id,
                user_email: session.user_email,
                device_id: session.device_id,
                duration_minutes: session.duration_minutes
            }))
        };
    }
}

module.exports = new HVNCSessionService();
