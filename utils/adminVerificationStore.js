const { getRedisClient } = require('../config/redis');

// Fallback in-memory storage (when Redis is not available)
const fallbackStore = new Map();

// Redis key prefix for admin verification codes
const REDIS_PREFIX = 'admin_verification:';
const VERIFICATION_EXPIRY = 15 * 60; // 15 minutes in seconds

class AdminVerificationStore {
    constructor() {
        this.useRedis = true;
    }

    // Check if Redis is available
    isRedisAvailable() {
        const redisClient = getRedisClient();
        return redisClient !== null;
    }

    // Generate Redis key
    getRedisKey(email) {
        return `${REDIS_PREFIX}${email.toLowerCase()}`;
    }

    // Set verification code
    async setVerificationCode(email, code, adminData) {
        const verificationData = {
            code: code,
            adminData: adminData,
            createdAt: Date.now(),
            expiresAt: Date.now() + (VERIFICATION_EXPIRY * 1000),
            attempts: 0,
            email: email.toLowerCase()
        };

        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email);
                
                // Store as JSON string with expiration
                await redisClient.setEx(
                    key, 
                    VERIFICATION_EXPIRY, 
                    JSON.stringify(verificationData)
                );
                
                console.log(`✅ Admin verification code stored in Redis for ${email} (expires in ${VERIFICATION_EXPIRY}s)`);
                return true;
            } catch (error) {
                console.error('❌ Redis setVerificationCode error:', error);
                // Fall back to in-memory storage
                this.setVerificationCodeFallback(email, verificationData);
                return true;
            }
        } else {
            // Use fallback in-memory storage
            this.setVerificationCodeFallback(email, verificationData);
            return true;
        }
    }

    // Get verification data
    async getVerificationData(email) {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email);
                
                const data = await redisClient.get(key);
                if (!data) {
                    console.log(`🔍 No admin verification data found in Redis for ${email}`);
                    return null;
                }

                const verificationData = JSON.parse(data);
                
                // Check if expired (double check, even though Redis should handle this)
                if (Date.now() > verificationData.expiresAt) {
                    await redisClient.del(key);
                    console.log(`⏰ Expired admin verification code removed from Redis for ${email}`);
                    return null;
                }

                console.log(`✅ Retrieved admin verification data from Redis for ${email}`);
                return verificationData;
            } catch (error) {
                console.error('❌ Redis getVerificationData error:', error);
                // Fall back to in-memory storage
                return this.getVerificationDataFallback(email);
            }
        } else {
            // Use fallback in-memory storage
            return this.getVerificationDataFallback(email);
        }
    }

    // Increment verification attempts
    async incrementAttempts(email) {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email);
                
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
                
                console.log(`📈 Admin verification attempts incremented to ${verificationData.attempts} for ${email}`);
                return verificationData.attempts;
            } catch (error) {
                console.error('❌ Redis incrementAttempts error:', error);
                return this.incrementAttemptsFallback(email);
            }
        } else {
            return this.incrementAttemptsFallback(email);
        }
    }

    // Remove verification code
    async removeVerificationCode(email) {
        if (this.isRedisAvailable()) {
            try {
                const redisClient = getRedisClient();
                const key = this.getRedisKey(email);
                
                const result = await redisClient.del(key);
                if (result === 1) {
                    console.log(`�️ Admin verification code removed from Redis for ${email}`);
                } else {
                    console.log(`🔍 No admin verification code found to remove for ${email}`);
                }
                return result === 1;
            } catch (error) {
                console.error('❌ Redis removeVerificationCode error:', error);
                return this.removeVerificationCodeFallback(email);
            }
        } else {
            return this.removeVerificationCodeFallback(email);
        }
    }

    // Get all pending verifications (for debugging)
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
                            const email = key.replace(REDIS_PREFIX, '');
                            pending.push([email, { ...verificationData, ttl }]);
                        }
                    } catch (parseError) {
                        console.error(`Error parsing admin verification data for key ${key}:`, parseError);
                    }
                }
                
                console.log(`🔍 Retrieved ${pending.length} pending admin verifications from Redis`);
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
    setVerificationCodeFallback(email, verificationData) {
        fallbackStore.set(email.toLowerCase(), verificationData);
        console.log(`⚠️ Admin verification code stored in fallback memory for ${email}`);
        
        // Auto cleanup after expiry time
        setTimeout(() => {
            if (fallbackStore.has(email.toLowerCase())) {
                fallbackStore.delete(email.toLowerCase());
                console.log(`🗑️ Expired admin verification code removed from fallback memory for ${email}`);
            }
        }, VERIFICATION_EXPIRY * 1000);
    }

    getVerificationDataFallback(email) {
        const data = fallbackStore.get(email.toLowerCase());
        if (!data) {
            console.log(`🔍 No admin verification data found in fallback memory for ${email}`);
            return null;
        }

        // Check if expired
        if (Date.now() > data.expiresAt) {
            fallbackStore.delete(email.toLowerCase());
            console.log(`⏰ Expired admin verification code removed from fallback memory for ${email}`);
            return null;
        }

        console.log(`✅ Retrieved admin verification data from fallback memory for ${email}`);
        return data;
    }

    incrementAttemptsFallback(email) {
        const data = fallbackStore.get(email.toLowerCase());
        if (data) {
            data.attempts += 1;
            fallbackStore.set(email.toLowerCase(), data);
            console.log(`📈 Admin verification attempts incremented to ${data.attempts} for ${email} (fallback)`);
            return data.attempts;
        }
        return 0;
    }

    removeVerificationCodeFallback(email) {
        const result = fallbackStore.delete(email.toLowerCase());
        if (result) {
            console.log(`🗑️ Admin verification code removed from fallback memory for ${email}`);
        }
        return result;
    }

    getAllPendingFallback() {
        const now = Date.now();
        const pending = [];
        
        for (const [email, data] of fallbackStore.entries()) {
            if (now <= data.expiresAt) {
                const timeLeft = Math.floor((data.expiresAt - now) / 1000);
                pending.push([email, { ...data, ttl: timeLeft }]);
            } else {
                fallbackStore.delete(email);
            }
        }
        
        console.log(`🔍 Retrieved ${pending.length} pending admin verifications from fallback memory`);
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
                    activeVerifications: keys.length,
                    prefix: REDIS_PREFIX,
                    expiry: `${VERIFICATION_EXPIRY}s`
                };
            } catch (error) {
                return {
                    type: 'Redis (Error)',
                    error: error.message,
                    activeVerifications: 0
                };
            }
        } else {
            return {
                type: 'In-Memory Fallback',
                activeVerifications: fallbackStore.size,
                prefix: REDIS_PREFIX,
                expiry: `${VERIFICATION_EXPIRY}s`
            };
        }
    }
}

// Create singleton instance
const adminVerificationStore = new AdminVerificationStore();

module.exports = {
    setVerificationCode: (email, code, adminData) => adminVerificationStore.setVerificationCode(email, code, adminData),
    getVerificationData: (email) => adminVerificationStore.getVerificationData(email),
    incrementAttempts: (email) => adminVerificationStore.incrementAttempts(email),
    removeVerificationCode: (email) => adminVerificationStore.removeVerificationCode(email),
    getAllPending: () => adminVerificationStore.getAllPending(),
    getStorageType: () => adminVerificationStore.getStorageType(),
    getStorageStats: () => adminVerificationStore.getStorageStats()
};