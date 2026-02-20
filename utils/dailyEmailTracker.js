const { getRedisClient } = require('../config/redis');

/**
 * Daily Email Tracker Utility
 * Manages email frequency limits using Redis with daily expiration
 */

/**
 * Check if daily email limit has been reached for a user
 * @param {string} userId - User ID
 * @param {string} emailType - Type of email (e.g., 'admin_reply', 'chat_notification')
 * @returns {Promise<boolean>} - true if email can be sent, false if limit reached
 */
const canSendDailyEmail = async (userId, emailType = 'admin_reply') => {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient || !redisClient.connected) {
      console.log('⚠️ Redis not available, allowing email to prevent missing notifications');
      return true; // Fail gracefully - allow email if Redis is down
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const key = `daily_email:${emailType}:${userId}:${today}`;
    
    const emailSent = await redisClient.get(key);
    return !emailSent; // Return true if no email sent today (emailSent is null)
    
  } catch (error) {
    console.error('❌ Error checking daily email limit:', error);
    return true; // Fail gracefully - allow email if there's an error
  }
};

/**
 * Mark that a daily email has been sent to a user
 * @param {string} userId - User ID
 * @param {string} emailType - Type of email (e.g., 'admin_reply', 'chat_notification')
 * @returns {Promise<boolean>} - true if marked successfully
 */
const markDailyEmailSent = async (userId, emailType = 'admin_reply') => {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient || !redisClient.connected) {
      console.log('⚠️ Redis not available, cannot track email sent status');
      return false;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const key = `daily_email:${emailType}:${userId}:${today}`;
    
    // Set key with expiration of 25 hours (just over a day to handle timezone differences)
    const expirationSeconds = 25 * 60 * 60; // 25 hours in seconds
    await redisClient.setex(key, expirationSeconds, new Date().toISOString());
    
    console.log(`✅ Marked daily email sent for user ${userId}, type: ${emailType}, date: ${today}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error marking daily email sent:', error);
    return false;
  }
};

/**
 * Get daily email status for debugging
 * @param {string} userId - User ID
 * @param {string} emailType - Type of email
 * @returns {Promise<Object>} - Email status information
 */
const getDailyEmailStatus = async (userId, emailType = 'admin_reply') => {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient || !redisClient.connected) {
      return { canSend: true, lastSent: null, reason: 'Redis not available' };
    }

    const today = new Date().toISOString().split('T')[0];
    const key = `daily_email:${emailType}:${userId}:${today}`;
    
    const lastSent = await redisClient.get(key);
    const ttl = await redisClient.ttl(key);
    
    return {
      canSend: !lastSent,
      lastSent: lastSent,
      expiresIn: ttl > 0 ? ttl : 0,
      key: key,
      today: today
    };
    
  } catch (error) {
    console.error('❌ Error getting daily email status:', error);
    return { canSend: true, lastSent: null, reason: 'Error checking status' };
  }
};

/**
 * Reset daily email limit for a user (for testing or special cases)
 * @param {string} userId - User ID
 * @param {string} emailType - Type of email
 * @returns {Promise<boolean>} - true if reset successfully
 */
const resetDailyEmailLimit = async (userId, emailType = 'admin_reply') => {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient || !redisClient.connected) {
      console.log('⚠️ Redis not available, cannot reset email limit');
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const key = `daily_email:${emailType}:${userId}:${today}`;
    
    await redisClient.del(key);
    console.log(`🔄 Reset daily email limit for user ${userId}, type: ${emailType}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error resetting daily email limit:', error);
    return false;
  }
};

/**
 * Clean up old email tracking keys (optional maintenance function)
 * @param {number} daysOld - Remove keys older than this many days (default: 7)
 */
const cleanupOldEmailKeys = async (daysOld = 7) => {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient || !redisClient.connected) {
      console.log('⚠️ Redis not available for cleanup');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    // This is a simple approach - Redis will auto-expire keys anyway
    // But we can implement pattern matching if needed
    console.log(`🧹 Email key cleanup would remove keys older than ${cutoffDateString}`);
    
  } catch (error) {
    console.error('❌ Error during email key cleanup:', error);
  }
};

module.exports = {
  canSendDailyEmail,
  markDailyEmailSent,
  getDailyEmailStatus,
  resetDailyEmailLimit,
  cleanupOldEmailKeys
};