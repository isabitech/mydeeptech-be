const redis = require('redis');
const { getRedisClient } = require('../config/redis');

/**
 * Simple in-memory rate limiter for development/testing
 * In production, this should use Redis for distributed rate limiting
 */
class InMemoryRateLimiter {
  constructor() {
    this.requests = new Map(); // IP -> { count, resetTime }
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(ip);
      }
    }
  }

  isAllowed(ip, windowMs, maxRequests) {
    const now = Date.now();
    const data = this.requests.get(ip);

    if (!data || now > data.resetTime) {
      // First request or window expired
      this.requests.set(ip, {
        count: 1,
        resetTime: now + windowMs
      });
      return { allowed: true, count: 1, resetTime: now + windowMs };
    }

    if (data.count >= maxRequests) {
      return { allowed: false, count: data.count, resetTime: data.resetTime };
    }

    // Increment counter
    data.count++;
    this.requests.set(ip, data);
    
    return { allowed: true, count: data.count, resetTime: data.resetTime };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

/**
 * Redis-based rate limiter for production
 */
class RedisRateLimiter {
  constructor() {
    this.redis = null;
    this.initRedis();
  }

  async initRedis() {
    try {
      this.redis = await getRedisClient();
    } catch (error) {
      console.warn('Redis not available for rate limiting, falling back to in-memory');
      this.redis = null;
    }
  }

  async isAllowed(ip, windowMs, maxRequests) {
    if (!this.redis) {
      // Fallback to in-memory if Redis is not available
      const memoryLimiter = new InMemoryRateLimiter();
      return memoryLimiter.isAllowed(ip, windowMs, maxRequests);
    }

    const key = `rate_limit:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis sorted set to store timestamps of requests
      const multi = this.redis.multi();
      
      // Remove old entries outside the window
      multi.zremrangebyscore(key, '-inf', windowStart);
      
      // Count current requests in window
      multi.zcard(key);
      
      // Add current request
      multi.zadd(key, now, now);
      
      // Set expiry for the key
      multi.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await multi.exec();
      const count = results[1][1]; // Get count from zcard result

      if (count >= maxRequests) {
        return { 
          allowed: false, 
          count: count, 
          resetTime: now + windowMs - (now % windowMs) 
        };
      }

      return { 
        allowed: true, 
        count: count + 1, 
        resetTime: now + windowMs - (now % windowMs)
      };

    } catch (error) {
      console.error('Redis rate limiter error:', error);
      // Fallback to allowing the request if Redis fails
      return { allowed: true, count: 1, resetTime: now + windowMs };
    }
  }
}

// Global rate limiter instances
let memoryLimiter = new InMemoryRateLimiter();
let redisLimiter = new RedisRateLimiter();

/**
 * Rate limiting middleware factory
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests per window
 * @param {Object} options.message - Error message to send when limit exceeded
 * @param {boolean} options.skipSuccessfulRequests - Skip counting successful requests
 * @param {Function} options.onLimitReached - Callback when limit is reached
 * @param {Function} options.keyGenerator - Custom key generator function
 */
function rateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
    skipSuccessfulRequests = false,
    onLimitReached = null,
    keyGenerator = (req) => req.ip || req.connection.remoteAddress
  } = options;

  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      
      if (!key) {
        // If we can't identify the request, allow it
        return next();
      }

      // Choose rate limiter based on Redis availability
      const limiter = redisLimiter.redis ? redisLimiter : memoryLimiter;
      const result = await limiter.isAllowed(key, windowMs, max);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - result.count),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        // Rate limit exceeded
        if (onLimitReached) {
          try {
            await onLimitReached(req, res);
          } catch (callbackError) {
            console.error('Rate limit callback error:', callbackError);
          }
        }

        return res.status(429).json(message);
      }

      // Store count for potential use in skipSuccessfulRequests
      req.rateLimit = {
        limit: max,
        current: result.count,
        remaining: max - result.count,
        resetTime: result.resetTime
      };

      // Handle skipSuccessfulRequests
      if (skipSuccessfulRequests) {
        const originalSend = res.send.bind(res);
        res.send = function(body) {
          // If response is successful (2xx), don't count this request
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // We could implement decrementing logic here if needed
            // For now, we'll just pass through
          }
          return originalSend(body);
        };
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request to proceed
      next();
    }
  };
}

/**
 * Predefined rate limiters for common use cases
 */
const presets = {
  // Strict rate limiting for authentication endpoints
  auth: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per 15 minutes
    message: {
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT',
        message: 'Too many authentication attempts. Please try again later.'
      }
    }
  }),

  // General API rate limiting
  api: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
      success: false,
      error: {
        code: 'API_RATE_LIMIT',
        message: 'Too many requests. Please try again later.'
      }
    }
  }),

  // Strict rate limiting for device registration
  deviceRegistration: rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 device registrations per hour per IP
    message: {
      success: false,
      error: {
        code: 'REGISTRATION_RATE_LIMIT',
        message: 'Too many device registration attempts. Please try again later.'
      }
    }
  }),

  // Rate limiting for WebSocket connections
  websocket: rateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 connection attempts per 5 minutes
    message: {
      success: false,
      error: {
        code: 'WEBSOCKET_RATE_LIMIT',
        message: 'Too many WebSocket connection attempts.'
      }
    }
  }),

  // Rate limiting for admin actions
  admin: rateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 admin actions per 5 minutes
    keyGenerator: (req) => req.admin?.email || req.ip, // Use admin email as key
    message: {
      success: false,
      error: {
        code: 'ADMIN_RATE_LIMIT',
        message: 'Too many admin actions. Please slow down.'
      }
    }
  })
};

/**
 * Create device-specific rate limiter
 * @param {string} deviceId - Device ID to rate limit
 * @param {Object} options - Rate limiting options
 */
function deviceRateLimiter(deviceId, options = {}) {
  return rateLimiter({
    ...options,
    keyGenerator: (req) => `device:${deviceId}`
  });
}

/**
 * Create user-specific rate limiter
 * @param {string} userEmail - User email to rate limit
 * @param {Object} options - Rate limiting options
 */
function userRateLimiter(userEmail, options = {}) {
  return rateLimiter({
    ...options,
    keyGenerator: (req) => `user:${userEmail}`
  });
}

// Cleanup function for graceful shutdown
function cleanup() {
  if (memoryLimiter) {
    memoryLimiter.destroy();
    memoryLimiter = null;
  }
  redisLimiter = null;
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  rateLimiter,
  presets,
  deviceRateLimiter,
  userRateLimiter,
  cleanup
};