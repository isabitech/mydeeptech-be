const { getRedisClient } = require('../config/redis');

// Fallback in-memory storage (when Redis is not available)
const fallbackStore = new Map();

// Redis key prefix for HVNC access code verification
const REDIS_PREFIX = 'hvnc_access_code:';
const VERIFICATION_EXPIRY = 15 * 60; // 15 minutes in seconds

class HVNCVerificationStore {
    constructor() {
        this.useRedis = true;
    }

    // Check if Redis is available
    isRedisAvailable() {
        const redisClient = getRedisClient();
        return redisClient !== null;
    }

    // Generate Redis key
    getRedisKey(email, deviceId) {
        return `${REDIS_PREFIX}${email.toLowerCase()}:${deviceId}`;
    }

    // Set access code for user and device
    async setAccessCode(email, deviceId, code, userData) {
        const verificationData = {
            code: code,
            userData: userData,
            createdAt: Date.now(),
            expiresAt: Date.now() + (VERIFICATION_EXPIRY * 1000),
            attempts: 0,
            email: email.toLowerCase(),
            deviceId: deviceId
        };

        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email, deviceId);
                
                // Store as JSON string with expiration
                await redisClient.setEx(
                    key, 
                    VERIFICATION_EXPIRY, 
                    JSON.stringify(verificationData)
                );
                
                console.log(`✅ HVNC access code stored in Redis for ${email}:${deviceId} (expires in ${VERIFICATION_EXPIRY}s)`);
                return true;
            } catch (error) {
                console.error('❌ Redis setAccessCode error:', error);
                // Fall back to in-memory storage
                return this.setAccessCodeFallback(email, deviceId, verificationData);
            }
        } else {
            return this.setAccessCodeFallback(email, deviceId, verificationData);
        }
    }

    // Get access code verification data
    async getAccessCodeData(email, deviceId) {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email, deviceId);
                
                const data = await redisClient.get(key);
                if (!data) {
                    console.log(`🔍 No HVNC access code found in Redis for ${email}:${deviceId}`);
                    return null;
                }

                const verificationData = JSON.parse(data);
                
                // Check if expired (double check, even though Redis should handle this)
                if (Date.now() > verificationData.expiresAt) {
                    await redisClient.del(key);
                    console.log(`⏰ Expired HVNC access code removed from Redis for ${email}:${deviceId}`);
                    return null;
                }

                console.log(`✅ Retrieved HVNC access code from Redis for ${email}:${deviceId}`);
                return verificationData;
            } catch (error) {
                console.error('❌ Redis getAccessCodeData error:', error);
                // Fall back to in-memory storage
                return this.getAccessCodeDataFallback(email, deviceId);
            }
        } else {
            return this.getAccessCodeDataFallback(email, deviceId);
        }
    }

    // Increment verification attempts
    async incrementAttempts(email, deviceId) {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email, deviceId);
                
                const data = await redisClient.get(key);
                if (!data) {
                    return 0;
                }

                const verificationData = JSON.parse(data);
                verificationData.attempts += 1;
                
                // Get remaining TTL and update the data
                const ttl = await redisClient.ttl(key);
                if (ttl > 0) {
                    await redisClient.setEx(key, ttl, JSON.stringify(verificationData));
                }
                
                console.log(`📈 HVNC access code attempts incremented to ${verificationData.attempts} for ${email}:${deviceId}`);
                return verificationData.attempts;
            } catch (error) {
                console.error('❌ Redis incrementAttempts error:', error);
                return this.incrementAttemptsFallback(email, deviceId);
            }
        } else {
            return this.incrementAttemptsFallback(email, deviceId);
        }
    }

    // Remove access code
    async removeAccessCode(email, deviceId) {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email, deviceId);
                
                const result = await redisClient.del(key);
                if (result === 1) {
                    console.log(`🗑️ HVNC access code removed from Redis for ${email}:${deviceId}`);
                } else {
                    console.log(`🔍 No HVNC access code found to remove for ${email}:${deviceId}`);
                }
                return result === 1;
            } catch (error) {
                console.error('❌ Redis removeAccessCode error:', error);
                return this.removeAccessCodeFallback(email, deviceId);
            }
        } else {
            return this.removeAccessCodeFallback(email, deviceId);
        }
    }

    // Validate access code
    async validateCode(email, deviceId, submittedCode) {
        console.log(`🔐 Validating HVNC access code for ${email}:${deviceId}`);
        
        const verificationData = await this.getAccessCodeData(email, deviceId);
        if (!verificationData) {
            console.log(`❌ No access code data found for ${email}:${deviceId}`);
            return {
                valid: false,
                reason: 'CODE_NOT_FOUND',
                message: 'No access code found or code expired'
            };
        }

        // Check if expired
        if (Date.now() > verificationData.expiresAt) {
            await this.removeAccessCode(email, deviceId);
            console.log(`❌ Access code expired for ${email}:${deviceId}`);
            return {
                valid: false,
                reason: 'CODE_EXPIRED',
                message: 'Access code has expired'
            };
        }

        // Check attempt limit
        if (verificationData.attempts >= 3) {
            await this.removeAccessCode(email, deviceId);
            console.log(`❌ Too many attempts for ${email}:${deviceId}`);
            return {
                valid: false,
                reason: 'TOO_MANY_ATTEMPTS',
                message: 'Too many attempts. Please request a new code.'
            };
        }

        // Validate the code
        if (submittedCode !== verificationData.code) {
            const attempts = await this.incrementAttempts(email, deviceId);
            console.log(`❌ Invalid code for ${email}:${deviceId}. Attempts: ${attempts}`);
            return {
                valid: false,
                reason: 'INVALID_CODE',
                message: 'Invalid access code',
                attemptsRemaining: 3 - attempts
            };
        }

        // Code is valid - remove from storage after successful validation
        await this.removeAccessCode(email, deviceId);
        console.log(`✅ Access code validated successfully for ${email}:${deviceId}`);
        
        return {
            valid: true,
            userData: verificationData.userData,
            message: 'Access code validated successfully'
        };
    }

    // Get all pending access codes (for debugging)
    async getAllPending() {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const pattern = `${REDIS_PREFIX}*`;
                const keys = await redisClient.keys(pattern);
                
                if (keys.length === 0) {
                    return [];
                }

                const pending = [];
                for (const key of keys) {
                    try {
                        const data = await redisClient.get(key);
                        const ttl = await redisClient.ttl(key);
                        
                        if (data) {
                            const verificationData = JSON.parse(data);
                            const userDevice = key.replace(REDIS_PREFIX, '');
                            pending.push([userDevice, { ...verificationData, ttl }]);
                        }
                    } catch (parseError) {
                        console.error(`Error parsing HVNC access code data for key ${key}:`, parseError);
                    }
                }
                
                console.log(`🔍 Retrieved ${pending.length} pending HVNC access codes from Redis`);
                return pending;
            } catch (error) {
                console.error('❌ Redis getAllPending error:', error);
                return this.getAllPendingFallback();
            }
        } else {
            return this.getAllPendingFallback();
        }
    }

    // === FALLBACK IN-MEMORY METHODS ===
    setAccessCodeFallback(email, deviceId, verificationData) {
        const key = `${email}:${deviceId}`;
        fallbackStore.set(key, verificationData);
        
        // Set timeout to remove expired data
        setTimeout(() => {
            fallbackStore.delete(key);
        }, VERIFICATION_EXPIRY * 1000);
        
        console.log(`✅ HVNC access code stored in fallback memory for ${email}:${deviceId}`);
        return true;
    }

    getAccessCodeDataFallback(email, deviceId) {
        const key = `${email}:${deviceId}`;
        const data = fallbackStore.get(key);
        
        if (!data) {
            console.log(`🔍 No HVNC access code found in fallback memory for ${email}:${deviceId}`);
            return null;
        }

        // Check if expired
        if (Date.now() > data.expiresAt) {
            fallbackStore.delete(key);
            console.log(`⏰ Expired HVNC access code removed from fallback memory for ${email}:${deviceId}`);
            return null;
        }

        console.log(`✅ Retrieved HVNC access code from fallback memory for ${email}:${deviceId}`);
        return data;
    }

    incrementAttemptsFallback(email, deviceId) {
        const key = `${email}:${deviceId}`;
        const data = fallbackStore.get(key);
        
        if (data) {
            data.attempts += 1;
            console.log(`📈 HVNC access code attempts incremented to ${data.attempts} for ${email}:${deviceId} (fallback)`);
            return data.attempts;
        }
        
        return 0;
    }

    removeAccessCodeFallback(email, deviceId) {
        const key = `${email}:${deviceId}`;
        const result = fallbackStore.delete(key);
        if (result) {
            console.log(`🗑️ HVNC access code removed from fallback memory for ${email}:${deviceId}`);
        }
        return result;
    }

    getAllPendingFallback() {
        const now = Date.now();
        const pending = [];
        
        for (const [key, data] of fallbackStore.entries()) {
            if (now <= data.expiresAt) {
                const timeLeft = Math.floor((data.expiresAt - now) / 1000);
                pending.push([key, { ...data, ttl: timeLeft }]);
            } else {
                fallbackStore.delete(key);
            }
        }
        
        console.log(`🔍 Retrieved ${pending.length} pending HVNC access codes from fallback memory`);
        return pending;
    }

    // Get storage type being used
    getStorageType() {
        return this.isRedisAvailable() ? 'Redis' : 'In-Memory Fallback';
    }

    // Get storage stats
    async getStorageStats() {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const pattern = `${REDIS_PREFIX}*`;
                const keys = await redisClient.keys(pattern);
                
                return {
                    type: 'Redis',
                    activeAccessCodes: keys.length,
                    prefix: REDIS_PREFIX,
                    expiry: `${VERIFICATION_EXPIRY}s`
                };
            } catch (error) {
                return {
                    type: 'Redis (Error)',
                    error: error.message,
                    activeAccessCodes: 0
                };
            }
        } else {
            return {
                type: 'In-Memory Fallback',
                activeAccessCodes: fallbackStore.size,
                prefix: REDIS_PREFIX,
                expiry: `${VERIFICATION_EXPIRY}s`
            };
        }
    }
}

// Create singleton instance
const hvncVerificationStore = new HVNCVerificationStore();

module.exports = {
    setAccessCode: (email, deviceId, code, userData) => hvncVerificationStore.setAccessCode(email, deviceId, code, userData),
    getAccessCodeData: (email, deviceId) => hvncVerificationStore.getAccessCodeData(email, deviceId),
    validateCode: (email, deviceId, code) => hvncVerificationStore.validateCode(email, deviceId, code),
    incrementAttempts: (email, deviceId) => hvncVerificationStore.incrementAttempts(email, deviceId),
    removeAccessCode: (email, deviceId) => hvncVerificationStore.removeAccessCode(email, deviceId),
    getAllPending: () => hvncVerificationStore.getAllPending(),
    getStorageType: () => hvncVerificationStore.getStorageType(),
    getStorageStats: () => hvncVerificationStore.getStorageStats()
};