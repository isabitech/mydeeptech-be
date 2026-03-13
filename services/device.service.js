const DeviceRepository = require('../repositories/device.repository');
const LogRepository = require('../repositories/log.repository');
const slugify = require('slugify');

class DeviceService {

    /**
     * Get all devices with filtering and pagination
     */
    static async getAllDevices(queryParams) {
        try {
            const result = await DeviceRepository.getDevices(queryParams);
            
            // Log the operation
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'list_devices',
                message: `Retrieved ${result.devices.length} devices`,
                source: 'api',
                user: {
                    id: queryParams.userId,
                    ipAddress: queryParams.ipAddress
                }
            });

            return result;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'list_devices_failed',
                message: `Failed to retrieve devices: ${error.message}`,
                source: 'api',
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to retrieve devices: ${error.message}`);
        }
    }

    /**
     * Get device by ID
     */
    static async getDeviceById(deviceId, requestContext = {}) {
        try {
            const device = await DeviceRepository.getDeviceById(deviceId);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'get_device',
                message: `Retrieved device: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                }
            });

            return device;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'get_device_failed',
                message: `Failed to retrieve device ${deviceId}: ${error.message}`,
                source: 'api',
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to retrieve device: ${error.message}`);
        }
    }

    /**
     * Create new device
     */
    static async createDevice(deviceData, requestContext = {}) {
        try {
            // Validate required fields
            if (!deviceData.name) {
                throw new Error('Device name is required');
            }

            if (!deviceData.deviceId) {
                throw new Error('Device ID is required');
            }

            // Generate slug for device name if not provided
            if (!deviceData.slug) {
                deviceData.slug = await this.generateUniqueSlug(deviceData.name);
            }

            // Set default values
            const defaultData = {
                status: 'offline',
                isActive: true,
                lastSeen: new Date(),
                ...deviceData
            };

            const device = await DeviceRepository.createDevice(defaultData);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'create_device',
                message: `Created device: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                },
                resource: {
                    type: 'device',
                    id: device._id,
                    name: device.name
                }
            });

            return device;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'create_device_failed',
                message: `Failed to create device: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to create device: ${error.message}`);
        }
    }

    /**
     * Update device
     */
    static async updateDevice(deviceId, updateData, requestContext = {}) {
        try {
            // Get original device for comparison
            const originalDevice = await DeviceRepository.getDeviceById(deviceId);
            
            const device = await DeviceRepository.updateDevice(deviceId, updateData);
            
            // Log important changes
            const changes = this.getDeviceChanges(originalDevice, device);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'update_device',
                message: `Updated device: ${device.name}. Changes: ${changes}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                },
                resource: {
                    type: 'device',
                    id: device._id,
                    name: device.name
                },
                metadata: {
                    changes: updateData
                }
            });

            return device;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'update_device_failed',
                message: `Failed to update device ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to update device: ${error.message}`);
        }
    }

    /**
     * Delete device
     */
    static async deleteDevice(deviceId, requestContext = {}) {
        try {
            const device = await DeviceRepository.getDeviceById(deviceId);
            await DeviceRepository.deleteDevice(deviceId);
            
            await LogRepository.createLog({
                level: 'warn',
                category: 'device',
                action: 'delete_device',
                message: `Deleted device: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                },
                resource: {
                    type: 'device',
                    id: device._id,
                    name: device.name
                }
            });

            return { message: 'Device deleted successfully', device };
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'delete_device_failed',
                message: `Failed to delete device ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to delete device: ${error.message}`);
        }
    }

    /**
     * Send command to device
     */
    static async sendDeviceCommand(deviceId, command, requestContext = {}) {
        try {
            const device = await DeviceRepository.getDeviceById(deviceId);
            
            if (!device.isAvailable()) {
                throw new Error('Device is not available for commands');
            }

            // Simulate command execution (this would integrate with actual device management system)
            const commandResult = await this.executeDeviceCommand(device, command);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'send_command',
                message: `Sent command '${command.type}' to device: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                },
                metadata: {
                    command,
                    result: commandResult
                }
            });

            return commandResult;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'send_command_failed',
                message: `Failed to send command to device ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to send command: ${error.message}`);
        }
    }

    /**
     * Get device Hubstaff status
     */
    static async getDeviceHubstaffStatus(deviceId, requestContext = {}) {
        try {
            const device = await DeviceRepository.getDeviceById(deviceId);
            
            // Simulate Hubstaff API integration
            const hubstaffStatus = await this.fetchHubstaffStatus(device);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'get_hubstaff_status',
                message: `Retrieved Hubstaff status for device: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                }
            });

            return hubstaffStatus;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'get_hubstaff_status_failed',
                message: `Failed to get Hubstaff status for device ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to get Hubstaff status: ${error.message}`);
        }
    }

    /**
     * Get device logs
     */
    static async getDeviceLogs(deviceId, queryParams = {}, requestContext = {}) {
        try {
            const { startDate, endDate, limit = 100 } = queryParams;
            const logs = await LogRepository.getDeviceLogs(deviceId, startDate, endDate, limit);
            
            return {
                deviceId,
                logs,
                total: logs.length
            };
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'get_device_logs_failed',
                message: `Failed to get logs for device ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to get device logs: ${error.message}`);
        }
    }

    /**
     * Assign user to device
     */
    static async assignDeviceUser(deviceId, userId, permissions, requestContext = {}) {
        try {
            const device = await DeviceRepository.assignUser(deviceId, userId, permissions);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'assign_user',
                message: `Assigned user to device: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                },
                metadata: {
                    assignedUserId: userId,
                    permissions
                }
            });

            return device;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'assign_user_failed',
                message: `Failed to assign user to device ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to assign user to device: ${error.message}`);
        }
    }

    /**
     * Get available devices
     */
    static async getAvailableDevices(filters = {}, requestContext = {}) {
        try {
            const devices = await DeviceRepository.getAvailableDevices(filters);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'get_available_devices',
                message: `Retrieved ${devices.length} available devices`,
                source: 'api',
                user: requestContext.user
            });

            return devices;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'get_available_devices_failed',
                message: `Failed to get available devices: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to get available devices: ${error.message}`);
        }
    }

    /**
     * Update device status
     */
    static async updateDeviceStatus(deviceId, status, requestContext = {}) {
        try {
            const device = await DeviceRepository.updateStatus(deviceId, status);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'update_status',
                message: `Updated device status to ${status}: ${device.name}`,
                source: 'api',
                user: requestContext.user,
                device: {
                    id: device._id,
                    deviceId: device.deviceId,
                    name: device.name
                },
                metadata: {
                    newStatus: status,
                    timestamp: new Date()
                }
            });

            return device;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'update_status_failed',
                message: `Failed to update device status ${deviceId}: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to update device status: ${error.message}`);
        }
    }

    /**
     * Get device statistics
     */
    static async getDeviceStatistics(requestContext = {}) {
        try {
            const stats = await DeviceRepository.getDeviceStats();
            
            await LogRepository.createLog({
                level: 'info',
                category: 'device',
                action: 'get_statistics',
                message: 'Retrieved device statistics',
                source: 'api',
                user: requestContext.user
            });

            return stats;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'device',
                action: 'get_statistics_failed',
                message: `Failed to get device statistics: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to get device statistics: ${error.message}`);
        }
    }

    /**
     * Private helper methods
     */
    
    static async generateUniqueSlug(name) {
        const Device = require('../models/device.model');
        let baseSlug = slugify(name, { lower: true, strict: true });
        let slug = baseSlug;
        let counter = 1;

        while (await Device.exists({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug;
    }

    static getDeviceChanges(original, updated) {
        const changes = [];
        
        if (original.status !== updated.status) {
            changes.push(`status: ${original.status} → ${updated.status}`);
        }
        
        if (original.name !== updated.name) {
            changes.push(`name: ${original.name} → ${updated.name}`);
        }
        
        if (original.isActive !== updated.isActive) {
            changes.push(`active: ${original.isActive} → ${updated.isActive}`);
        }

        return changes.length > 0 ? changes.join(', ') : 'minor updates';
    }

    static async executeDeviceCommand(device, command) {
        // This would integrate with actual device management system
        // For now, return a simulated response
        const commandTypes = {
            'restart': 'Device restart initiated',
            'shutdown': 'Device shutdown initiated',
            'lock': 'Device locked successfully',
            'unlock': 'Device unlocked successfully',
            'update': 'Device update started',
            'scan': 'Device scan completed'
        };

        return {
            deviceId: device.deviceId,
            command: command.type,
            status: 'success',
            message: commandTypes[command.type] || 'Command executed',
            timestamp: new Date(),
            executionTime: Math.random() * 1000 + 500 // Simulated execution time
        };
    }

    static async fetchHubstaffStatus(device) {
        // This would integrate with Hubstaff API
        // For now, return simulated data
        return {
            deviceId: device.deviceId,
            hubstaffDeviceId: device.hubstaff?.deviceId || null,
            isActive: device.hubstaff?.isActive || false,
            lastActivity: device.hubstaff?.lastActivity || device.lastSeen,
            status: device.status === 'online' ? 'online' : 'offline',
            configuration: device.hubstaff?.configuration || {},
            metrics: {
                uptime: Math.floor(Math.random() * 86400), // seconds
                activeTime: Math.floor(Math.random() * 28800), // seconds
                idleTime: Math.floor(Math.random() * 3600) // seconds
            },
            retrievedAt: new Date()
        };
    }
}

module.exports = DeviceService;