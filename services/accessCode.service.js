const AccessCodeRepository = require('../repositories/accessCode.repository');
const LogRepository = require('../repositories/log.repository');
const crypto = require('crypto');

class AccessCodeService {

    /**
     * Get all access codes
     */
    static async getAllAccessCodes(queryParams) {
        try {
            const result = await AccessCodeRepository.getAccessCodes(queryParams);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'access',
                action: 'list_codes',
                message: `Retrieved ${result.codes.length} access codes`,
                source: 'api',
                user: {
                    id: queryParams.userId,
                    ipAddress: queryParams.ipAddress
                }
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to retrieve access codes: ${error.message}`);
        }
    }

    /**
     * Generate new access code
     */
    static async generateAccessCode(codeData, requestContext = {}) {
        try {
            // Validate required fields
            if (!codeData.type) {
                throw new Error('Access code type is required');
            }

            if (!codeData.generatedBy) {
                throw new Error('Generator user ID is required');
            }

            if (!codeData.validity || !codeData.validity.endDate) {
                throw new Error('Validity end date is required');
            }

            const accessCode = await AccessCodeRepository.generateAccessCode(codeData);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'access',
                action: 'generate_code',
                message: `Generated access code: ${accessCode.code}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'accessCode',
                    id: accessCode._id,
                    name: accessCode.code
                },
                security: {
                    threat: 'none'
                }
            });

            return accessCode;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'access',
                action: 'generate_code_failed',
                message: `Failed to generate access code: ${error.message}`,
                source: 'api',
                user: requestContext.user,
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to generate access code: ${error.message}`);
        }
    }

    /**
     * Validate access code
     */
    static async validateAccessCode(code, validationContext = {}) {
        try {
            const result = await AccessCodeRepository.validateAccessCode(code, validationContext);
            
            const logLevel = result.valid ? 'info' : 'warn';
            const securityThreat = result.valid ? 'none' : 'low';
            
            await LogRepository.createLog({
                level: logLevel,
                category: 'security',
                action: 'validate_code',
                message: `Access code validation ${result.valid ? 'successful' : 'failed'}: ${code}`,
                source: 'api',
                user: {
                    id: validationContext.userId,
                    ipAddress: validationContext.ipAddress,
                    userAgent: validationContext.userAgent
                },
                security: {
                    threat: securityThreat,
                    blocked: !result.valid
                },
                metadata: {
                    code,
                    reason: result.reason
                }
            });

            return result;
        } catch (error) {
            await LogRepository.createLog({
                level: 'error',
                category: 'security',
                action: 'validate_code_error',
                message: `Error validating access code: ${error.message}`,
                source: 'api',
                user: {
                    id: validationContext.userId,
                    ipAddress: validationContext.ipAddress
                },
                security: {
                    threat: 'medium',
                    blocked: true
                },
                error: {
                    type: error.constructor.name,
                    stack: error.stack
                }
            });
            
            throw new Error(`Failed to validate access code: ${error.message}`);
        }
    }

    /**
     * Revoke access code
     */
    static async revokeAccessCode(code, revokedBy, reason, isEmergency = false, requestContext = {}) {
        try {
            const result = await AccessCodeRepository.revokeAccessCode(code, revokedBy, reason, isEmergency);
            
            await LogRepository.createLog({
                level: isEmergency ? 'warn' : 'info',
                category: 'security',
                action: 'revoke_code',
                message: `Access code revoked${isEmergency ? ' (EMERGENCY)' : ''}: ${code}`,
                source: 'api',
                user: requestContext.user,
                resource: {
                    type: 'accessCode',
                    id: result._id,
                    name: result.code
                },
                security: {
                    threat: isEmergency ? 'high' : 'none'
                },
                metadata: {
                    reason,
                    isEmergency,
                    revokedBy
                }
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to revoke access code: ${error.message}`);
        }
    }

    /**
     * Get usage history
     */
    static async getUsageHistory(code, limit, requestContext = {}) {
        try {
            const history = await AccessCodeRepository.getUsageHistory(code, limit);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'access',
                action: 'get_usage_history',
                message: `Retrieved usage history for code: ${code}`,
                source: 'api',
                user: requestContext.user
            });

            return history;
        } catch (error) {
            throw new Error(`Failed to get usage history: ${error.message}`);
        }
    }

    /**
     * Record code usage
     */
    static async recordUsage(codeId, usageData, requestContext = {}) {
        try {
            const result = await AccessCodeRepository.recordUsage(codeId, usageData);
            
            await LogRepository.createLog({
                level: 'info',
                category: 'access',
                action: 'record_usage',
                message: `Recorded access code usage: ${result.code}`,
                source: 'api',
                user: {
                    id: usageData.usedBy?.user,
                    ipAddress: usageData.usedBy?.ipAddress
                },
                resource: {
                    type: 'accessCode',
                    id: result._id,
                    name: result.code
                }
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to record usage: ${error.message}`);
        }
    }

    /**
     * Get expiring codes
     */
    static async getExpiringCodes(days = 7, requestContext = {}) {
        try {
            const codes = await AccessCodeRepository.getExpiringCodes(days);
            return codes;
        } catch (error) {
            throw new Error(`Failed to get expiring codes: ${error.message}`);
        }
    }

    /**
     * Cleanup expired codes
     */
    static async cleanupExpiredCodes(requestContext = {}) {
        try {
            const result = await AccessCodeRepository.cleanupExpiredCodes();
            
            await LogRepository.createLog({
                level: 'info',
                category: 'system',
                action: 'cleanup_expired_codes',
                message: `Cleaned up ${result.modifiedCount} expired access codes`,
                source: 'system',
                user: requestContext.user
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to cleanup expired codes: ${error.message}`);
        }
    }

    /**
     * Get access code statistics
     */
    static async getAccessCodeStatistics(requestContext = {}) {
        try {
            const stats = await AccessCodeRepository.getAccessCodeStats();
            return stats;
        } catch (error) {
            throw new Error(`Failed to get access code statistics: ${error.message}`);
        }
    }

    /**
     * Bulk operations
     */
    static async bulkRevokeAccessCodes(codeIds, revokedBy, reason, requestContext = {}) {
        try {
            const result = await AccessCodeRepository.bulkRevoke(codeIds, revokedBy, reason);
            
            await LogRepository.createLog({
                level: 'warn',
                category: 'security',
                action: 'bulk_revoke_codes',
                message: `Bulk revoked ${result.modifiedCount} access codes`,
                source: 'api',
                user: requestContext.user,
                metadata: {
                    codeIds,
                    reason,
                    revokedBy
                }
            });

            return result;
        } catch (error) {
            throw new Error(`Failed to bulk revoke codes: ${error.message}`);
        }
    }
}

module.exports = AccessCodeService;