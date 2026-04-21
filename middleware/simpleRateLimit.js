/**
 * Simple Rate Limiting Middleware
 *
 * Basic but effective rate limiting for Node.js Express apps.
 * Uses Redis for scaling, falls back to memory if Redis unavailable.
 */

const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const { getRedisClient } = require("../config/redis");

// Get client IP, handling proxy headers
const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.connection?.remoteAddress
  );
};

// Create Redis store once and reuse it
let storeInstance = null;
let storeInitialized = false;

const getStore = () => {
  if (!storeInitialized) {
    const redisClient = getRedisClient();
    if (redisClient?.isReady) {
      storeInstance = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: "rate_limit:",
      });
    } else {
      console.log(
        "⚠️ Redis not available - using memory store for rate limiting",
      );
      storeInstance = undefined; // Uses default memory store
    }
    storeInitialized = true;
  }
  return storeInstance;
};

// Simple rate limiter factory
const createRateLimit = (
  windowMinutes,
  maxRequests,
  message = "Too many requests",
) => {
  return rateLimit({
    store: getStore(),
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
      const ip = getClientIP(req);
      const { userId } = req.user || {};
      return userId ? `user_${userId}_${ip}` : `ip_${ip}`;
    },

    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: `${message}. Please try again after ${windowMinutes} minutes.`,
        retryAfter: `${windowMinutes} minutes`,
      });
    },
  });
};

// Pre-configured rate limiters
const rateLimiters = {
  // Strict auth limits (5 requests per 15 minutes)
  auth: createRateLimit(
    15,
    5,
    "Too many login attempts, please try again later",
  ),

  // General API limits (100 requests per 15 minutes)
  api: createRateLimit(15, 200, "API rate limit exceeded"),

  // Upload limits (5 uploads per hour)
  upload: createRateLimit(60, 5, "Upload rate limit exceeded"),

  // Lenient limits for authenticated users (500 requests per 15 minutes)
  user: createRateLimit(15, 500, "User rate limit exceeded"),
};

module.exports = { rateLimiters, createRateLimit };
