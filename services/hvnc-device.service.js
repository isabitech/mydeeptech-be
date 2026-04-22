const HVNCDevice = require('../models/hvnc-device.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const HVNCCommand = require('../models/hvnc-command.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class HVNCDeviceService {
    async registerDevice(data, context = {}) {
        const {
            device_id,
            pc_name,
            hostname,
            operating_system,
            os_version,
            browser_version,
            public_ip,
            ip_address,
            mac_address,
            system_info,
            hubstaff_installed,
            hubstaff_version,
            initial_access_code,
            installed_at
        } = data;
        const { originalIp, userAgent, host } = context;

        let existingDevice = await HVNCDevice.findByDeviceId(device_id);
        
        if (existingDevice) {
            existingDevice.last_seen = new Date();
            existingDevice.status = 'online';
            await existingDevice.save();

            await HVNCActivityLog.logDeviceEvent(device_id, 'device_reconnected', {
                result: 'existing_device',
                pc_name,
                system_info,
                public_ip: public_ip || ip_address || originalIp
            }, {
                status: 'info',
                ip_address: originalIp,
                user_agent: userAgent
            });

            const token = existingDevice.generateAuthToken();
            
            return {
                success: true,
                is_existing: true,
                device: {
                    id: existingDevice._id,
                    device_id: existingDevice.device_id,
                    pc_name: existingDevice.pc_name,
                    status: existingDevice.status,
                    registered_at: existingDevice.createdAt
                },
                token: token,
                expires_in: 30 * 24 * 60 * 60,
                config: existingDevice.config,
                message: 'Device reconnected successfully'
            };
        }

        const deviceData = {
            device_id,
            pc_name,
            hostname: hostname || pc_name,
            operating_system: operating_system || os_version || 'Unknown',
            browser_version: browser_version || 'Unknown',
            location: {
                ip: public_ip || ip_address || originalIp,
                country: 'Unknown',
                city: 'Unknown'
            },
            system_info: system_info || {},
            mac_address,
            hubstaff_info: {
                is_hubstaff_installed: hubstaff_installed || false,
                hubstaff_version
            },
            initial_access_code,
            installed_at: installed_at ? new Date(installed_at) : new Date(),
            status: 'online',
            last_seen: new Date()
        };

        const device = new HVNCDevice(deviceData);
        await device.save();

        const token = device.generateAuthToken();
        device.auth_token_hash = await bcrypt.hash(token, 10);
        
        device.config = {
            server_url: `wss://${host}/device`,
            heartbeat_interval: 60,
            encryption_key: Buffer.from(crypto.randomBytes(32)).toString('base64')
        };
        await device.save();

        return {
            success: true,
            is_existing: false,
            device: {
                id: device._id,
                device_id: device.device_id,
                pc_name: device.pc_name,
                status: device.status,
                registered_at: device.createdAt
            },
            token: token,
            expires_in: 30 * 24 * 60 * 60,
            config: device.config
        };
    }

    async heartbeat(device, data, context = {}) {
        const {
            status,
            uptime,
            chrome_status,
            hubstaff_status,
            desktop_status,
            system_info
        } = data;
        const { originalIp } = context;

        await device.updateHeartbeat({
            status: status || 'online',
            system_info,
            chrome_status,
            desktop_status
        });

        if (hubstaff_status) {
            const previousStatus = device.hubstaff_session?.is_timer_running;
            if (previousStatus !== hubstaff_status.timer_running) {
                await HVNCActivityLog.logDeviceEvent(device.device_id, 'hubstaff_status_update', {
                    timer_running: hubstaff_status.timer_running,
                    project_id: hubstaff_status.project_id,
                    project_name: hubstaff_status.project_name,
                    previous_state: previousStatus
                }, {
                    status: 'info',
                    ip_address: originalIp
                });
            }
        }

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            next_heartbeat: device.config?.heartbeat_interval || 60
        };

        if (data.check_config) {
            response.config_update = {
                heartbeat_interval: device.config?.heartbeat_interval || 60,
                server_url: device.config?.server_url
            };
        }

        return response;
    }

    async getCommands(device, query, context = {}) {
        const limit = parseInt(query.limit) || 10;
        const { originalIp } = context;
        const commands = await HVNCCommand.getPendingCommands(device.device_id, limit);

        for (const command of commands) {
            await command.markSent();
        }

        if (commands.length > 0) {
            await HVNCActivityLog.logDeviceEvent(device.device_id, 'command_received', {
                command_count: commands.length,
                command_types: commands.map(cmd => `${cmd.type}:${cmd.action}`)
            }, {
                status: 'info',
                ip_address: originalIp
            });
        }

        return {
            commands: commands.map(cmd => ({
                command_id: cmd.command_id,
                type: cmd.type,
                action: cmd.action,
                parameters: cmd.parameters,
                session_id: cmd.session_id,
                user_email: cmd.user_email,
                timestamp: cmd.createdAt.toISOString(),
                expires_at: cmd.expires_at.toISOString(),
                priority: cmd.priority,
                timeout_seconds: cmd.timeout_seconds
            }))
        };
    }

    async acknowledgeCommand(device, command_id, data, context = {}) {
        const { status, result, error } = data;
        const { start_time, originalIp } = context;

        const command = await HVNCCommand.findOne({
            command_id,
            device_id: device.device_id,
            status: { $in: ['sent', 'acknowledged', 'executing'] }
        });

        if (!command) {
            throw { status: 404, code: 'COMMAND_NOT_FOUND', message: 'Command not found or already processed' };
        }

        const executionTime = Date.now() - start_time;

        switch (status) {
            case 'success':
                await command.complete(result, executionTime);
                break;
            case 'error':
                await command.fail(error?.message || 'Command execution failed', error?.code);
                break;
            case 'timeout':
                await command.timeout();
                break;
            default:
                throw { status: 400, code: 'INVALID_STATUS', message: 'Status must be success, error, or timeout' };
        }

        await HVNCActivityLog.logCommandEvent(command_id, 'command_executed', {
            status,
            result: status === 'success' ? result : null,
            error: status === 'error' ? error : null,
            execution_time_ms: executionTime,
            command_type: command.type,
            command_action: command.action
        }, {
            status: status === 'success' ? 'success' : 'failure',
            device_id: device.device_id,
            session_id: command.session_id,
            user_email: command.user_email,
            ip_address: originalIp,
            duration_ms: executionTime
        });

        return {
            success: true,
            command_id,
            acknowledged_at: new Date().toISOString()
        };
    }

    async getDeviceStatus(device) {
        const HVNCSession = require('../models/hvnc-session.model');
        const activeSessions = await HVNCSession.findActiveSessionsForDevice(device.device_id);
        const pendingCommands = await HVNCCommand.countDocuments({
            device_id: device.device_id,
            status: { $in: ['pending', 'sent'] },
            expires_at: { $gt: new Date() }
        });

        return {
            success: true,
            device: {
                id: device._id,
                device_id: device.device_id,
                pc_name: device.pc_name,
                hostname: device.hostname,
                status: device.status,
                is_online: device.is_online,
                last_seen: device.last_seen,
                uptime: device.system_info?.uptime,
                chrome_status: device.chrome_status,
                hubstaff_status: device.hubstaff_status,
                desktop_status: device.desktop_status,
                system_info: device.system_info
            },
            active_sessions: activeSessions.map(session => ({
                session_id: session.session_id,
                user_email: session.user_email,
                started_at: session.started_at,
                last_activity: session.last_activity,
                status: session.status
            })),
            active_count: activeSessions.length,
            pending_commands_count: pendingCommands
        };
    }

    async updateConfig(device, data, context = {}) {
        const { heartbeat_interval, encryption_key, auto_screenshot } = data;
        const { originalIp } = context;

        const config = device.config || {};
        
        if (heartbeat_interval !== undefined) {
            config.heartbeat_interval = Math.max(30, Math.min(300, heartbeat_interval));
        }
        
        if (encryption_key) {
            config.encryption_key = encryption_key;
        }
        
        if (auto_screenshot !== undefined) {
            config.auto_screenshot = auto_screenshot;
        }

        device.config = config;
        await device.save();

        await HVNCActivityLog.logDeviceEvent(device.device_id, 'configuration_change', {
            changes: data,
            updated_by: 'device_self'
        }, {
            status: 'info',
            ip_address: originalIp
        });

        return {
            success: true,
            config: device.config
        };
    }

    async disconnect(device, data, context = {}) {
        const { reason = 'manual_disconnect' } = data;
        const { originalIp } = context;

        device.status = 'offline';
        device.last_seen = new Date();
        await device.save();

        const HVNCSession = require('../models/hvnc-session.model');
        const activeSessions = await HVNCSession.findActiveSessionsForDevice(device.device_id);
        
        for (const session of activeSessions) {
            await session.endSession('device_offline');
        }

        await HVNCCommand.cancelDeviceCommands(device.device_id, `Device disconnected: ${reason}`);

        await HVNCActivityLog.logDeviceEvent(device.device_id, 'device_offline', {
            reason,
            active_sessions_ended: activeSessions.length,
            disconnect_type: 'graceful'
        }, {
            status: 'info',
            ip_address: originalIp
        });

        return {
            success: true,
            message: 'Device disconnected successfully',
            affected_sessions: activeSessions.length
        };
    }
}

module.exports = new HVNCDeviceService();
