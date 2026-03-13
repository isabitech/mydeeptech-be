const Joi = require("joi");

 const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),

  PORT: Joi.number().default(4000),

  // MongoDB
  OLD_MONGO_URI: Joi.string().uri().optional(),
  MONGO_URI: Joi.string().uri().required(),
  NEW_MONGODB_PASSWORD: Joi.string().optional(),

  // JWT
  JWT_SECRET: Joi.string().required(),

  // Mailjet Email API (Optional alternative to Brevo)
  MAILJET_API_KEY: Joi.string().allow('').default(''),
  MAILJET_SECRET_KEY: Joi.string().allow('').default(''),
  MAILJET_SENDER_EMAIL: Joi.alternatives().try(
    Joi.string().email(),
    Joi.string().allow('')
  ).default(''),
  MAILJET_SENDER_NAME: Joi.string().allow('').default('MyDeepTech'),

  // Brevo Email API
  BREVO_API_KEY: Joi.string().required(),
  BREVO_SENDER_EMAIL: Joi.string().email().required(),
  BREVO_SENDER_NAME: Joi.string().required(),
  BREVO_PROJECT_SENDER_EMAIL: Joi.string().email().required(),
  BREVO_PROJECT_SENDER_NAME: Joi.string().required(),
  SMTP_SERVER: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_LOGIN: Joi.string().required(),
  SMTP_KEY: Joi.string().required(),

  // Legacy Gmail SMTP (backup)
  EMAIL_USER: Joi.string().email().optional(),
  EMAIL_PASS: Joi.string().optional(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_PASSWORD: Joi.string().required(),
  REDIS_DB: Joi.number().required(),

  // Admin
  NEW_ADMIN_NAME: Joi.string().required(),
  NEW_ADMIN_EMAIL: Joi.string().email().required(),
  NEW_ADMIN_PHONE: Joi.string().required(),
  NEW_ADMIN_PASSWORD: Joi.string().required(),
  ADMIN_CREATION_KEY: Joi.string().required(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // Misc / APIs
  YOUTUBE_API_KEY: Joi.string().required(),
  ip: Joi.string().optional(),
  EXCHANGE_RATE_API_KEY: Joi.string().required(),
  EXCHANGE_RATES_API_KEY: Joi.string().required(),

  // Swagger Configuration
  SWAGGER_URL: Joi.string().uri().optional(),
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').optional(),

  // HVNC System Configuration (All optional with defaults in envConfig.js)
  
  // HVNC JWT Settings
  HVNC_JWT_SECRET: Joi.string().optional(),
  HVNC_DEVICE_TOKEN_EXPIRY: Joi.string().optional(),
  HVNC_SESSION_TOKEN_EXPIRY: Joi.string().optional(),
  HVNC_ADMIN_TOKEN_EXPIRY: Joi.string().optional(),
  
  // HVNC Access Code Settings
  HVNC_ACCESS_CODE_LENGTH: Joi.number().min(4).max(8).optional(),
  HVNC_ACCESS_CODE_EXPIRY: Joi.string().optional(),
  
  // HVNC Session Settings
  HVNC_MAX_SESSION_DURATION: Joi.string().optional(),
  HVNC_SESSION_IDLE_TIMEOUT: Joi.string().optional(),
  
  // HVNC Shift Settings
  HVNC_ENFORCE_SHIFTS: Joi.string().valid('true', 'false').optional(),
  HVNC_SHIFT_START_TIME: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  HVNC_SHIFT_END_TIME: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  HVNC_SHIFT_TIMEZONE: Joi.string().optional(),  
  // HVNC Command Settings
  HVNC_COMMAND_TIMEOUT: Joi.string().optional(),
  HVNC_COMMAND_RETRY_ATTEMPTS: Joi.number().min(0).max(10).optional(),
  
  // HVNC WebSocket Settings
  HVNC_WEBSOCKET_PING_INTERVAL: Joi.number().min(5000).max(120000).optional(),
  HVNC_WEBSOCKET_PING_TIMEOUT: Joi.number().min(1000).max(30000).optional(),
  
  // HVNC Rate Limiting
  HVNC_RATE_LIMIT_WINDOW: Joi.number().min(60000).max(3600000).optional(), // 1min to 1hour
  HVNC_RATE_LIMIT_AUTH_MAX: Joi.number().min(1).max(100).optional(),
  HVNC_RATE_LIMIT_API_MAX: Joi.number().min(10).max(10000).optional(),
  
  // HVNC Device Settings
  HVNC_DEVICE_HEARTBEAT_INTERVAL: Joi.number().min(10000).max(300000).optional(), // 10s to 5min
  HVNC_DEVICE_OFFLINE_THRESHOLD: Joi.number().min(30000).max(1800000).optional(), // 30s to 30min
  
  // HVNC Admin Settings
  HVNC_DEFAULT_ADMIN_EMAIL: Joi.string().email().optional(),
  HVNC_DEFAULT_ADMIN_PASSWORD: Joi.string().optional(),
  
  // HVNC Hubstaff Integration
  HVNC_HUBSTAFF_ENABLED: Joi.string().valid('true', 'false').optional(),
  HVNC_HUBSTAFF_API_TOKEN: Joi.string().optional(),
  HVNC_HUBSTAFF_ORGANIZATION_ID: Joi.string().optional(),
  
  // HVNC Logging
  HVNC_ACTIVITY_LOG_RETENTION: Joi.string().optional(),
  HVNC_LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').optional(),

}).unknown(true); // allow other env vars like PATH, HOME, etc.

module.exports = envSchema;