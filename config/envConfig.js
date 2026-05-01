const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const envSchema = require("./_schemas/envSchema");

// Default to development if NODE_ENV is not set
const nodeEnv = process.env.NODE_ENV || "development";
const envFileCandidates = [`.env.${nodeEnv}`, ".env"];
const envFile = envFileCandidates.find((file) =>
  fs.existsSync(path.resolve(process.cwd(), file)),
);

// Prefer the environment-specific file when present, otherwise fall back to `.env`.
if (envFile) {
  dotenv.config({ path: envFile });
}

// Validate environment variables with Joi
const { value: env, error } = envSchema.validate(process.env, {
  abortEarly: false,
});


if (error) {
  throw new Error(
    `Environment validation error:\n${error.details
      .map((d) => `- ${d.message}`)
      .join("\n")}`
  );
}

const envConfig = {
  PORT: Number(env.PORT),
  FRONTEND_URL: env.FRONTEND_URL,
  BACKEND_URL: env.BACKEND_URL,


  mongo: {
    OLD_MONGO_URI: env.OLD_MONGO_URI,
    MONGO_URI: env.MONGO_URI,
    NEW_MONGODB_PASSWORD: env.NEW_MONGODB_PASSWORD,
  },

  jwt: {
    JWT_SECRET: env.JWT_SECRET,
  },

  email: {
    defaultProvider: env.EMAIL_PROVIDER || 'brevo', // 'mailjet' or 'brevo'
    
    // Email sender constants by purpose
    senders: {
      default: {
        email: env.BREVO_SENDER_EMAIL || 'no-reply@mydeeptech.ng',
        name: env.BREVO_SENDER_NAME || 'MyDeepTech Team'
      },
      projects: {
        // Try alternative sender for better deliverability
        email: env.BREVO_PROJECT_SENDER_EMAIL || env.BREVO_SENDER_EMAIL || 'projects@mydeeptech.ng',
        name: env.BREVO_PROJECT_SENDER_NAME || 'MyDeepTech Projects'
      },
      payments: {
        email: env.BREVO_PAYMENTS_SENDER_EMAIL || 'payments@mydeeptech.ng',
        name: env.BREVO_PAYMENTS_SENDER_NAME || 'MyDeepTech Payments'
      },
      support: {
        email: env.BREVO_SUPPORT_SENDER_EMAIL || 'support@mydeeptech.ng', 
        name: env.BREVO_SUPPORT_SENDER_NAME || 'MyDeepTech Support'
      }
    },
    
    mailjet: {
      MAILJET_API_KEY: env.MAILJET_API_KEY,
      MAILJET_SECRET_KEY: env.MAILJET_SECRET_KEY,
      MAILJET_SENDER_EMAIL: env.MAILJET_SENDER_EMAIL,
      MAILJET_SENDER_NAME: env.MAILJET_SENDER_NAME,
    },
    brevo: {
      BREVO_API_KEY: env.BREVO_API_KEY,
      BREVO_SENDER_EMAIL: env.BREVO_SENDER_EMAIL,
      BREVO_SENDER_NAME: env.BREVO_SENDER_NAME,
      BREVO_PROJECT_SENDER_EMAIL: env.BREVO_PROJECT_SENDER_EMAIL,
      BREVO_PROJECT_SENDER_NAME: env.BREVO_PROJECT_SENDER_NAME,
      SMTP_SERVER: env.SMTP_SERVER,
      SMTP_PORT: env.SMTP_PORT,
      SMTP_LOGIN: env.SMTP_LOGIN,
      SMTP_KEY: env.SMTP_KEY,
    },
    legacy: {
      EMAIL_USER: env.EMAIL_USER,
      EMAIL_PASS: env.EMAIL_PASS,
    },
  },

  redis: {
    REDIS_HOST: env.REDIS_HOST  || 'localhost',
    REDIS_PORT: env.REDIS_PORT  || 6379,
    REDIS_PASSWORD: env.REDIS_PASSWORD,
    REDIS_DB: env.REDIS_DB,
  },

  admin: {
    NEW_ADMIN_NAME: env.NEW_ADMIN_NAME,
    NEW_ADMIN_EMAIL: env.NEW_ADMIN_EMAIL,
    NEW_ADMIN_PHONE: env.NEW_ADMIN_PHONE,
    NEW_ADMIN_PASSWORD: env.NEW_ADMIN_PASSWORD,
    ADMIN_CREATION_KEY: env.ADMIN_CREATION_KEY,
  },

  cloudinary: {
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
  },

  YOUTUBE_API_KEY: env.YOUTUBE_API_KEY,
  ip: env.ip,
  EXCHANGE_RATE_API_KEY: env.EXCHANGE_RATE_API_KEY,
  EXCHANGE_RATES_API_KEY: env.EXCHANGE_RATES_API_KEY,

  ai: {
    GROQ_API_KEY: env.GROQ_API_KEY,
    AI_MODEL_MAIN: env.AI_MODEL_MAIN,
    AI_MODEL_SCORE: env.AI_MODEL_SCORE,
    AI_BASE_URL: env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
    AI_PROMPT_VERSION: env.AI_PROMPT_VERSION || 'v1.0',
  },

 NODE_ENV: env.NODE_ENV || nodeEnv,
 SWAGGER_URL: env.SWAGGER_URL || (env.NODE_ENV === 'production' ? 'https://mydeeptech-be.onrender.com' : 'http://localhost:4000'),

 // Enable/disable Swagger documentation
 SWAGGER_ENABLED: env.SWAGGER_ENABLED !== 'false', // Defaults to true unless explicitly disabled


 paystack: {
  PAYSTACK_SECRET_KEY: env.PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY: env.PAYSTACK_PUBLIC_KEY,
  PAYSTACK_BASE_URL: env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
},

 hvnc: {
   // JWT Settings
   JWT_SECRET: env.HVNC_JWT_SECRET || env.JWT_SECRET, // Fallback to main JWT secret
   DEVICE_TOKEN_EXPIRY: env.HVNC_DEVICE_TOKEN_EXPIRY || '30d',
   SESSION_TOKEN_EXPIRY: env.HVNC_SESSION_TOKEN_EXPIRY || '8h',
   ADMIN_TOKEN_EXPIRY: env.HVNC_ADMIN_TOKEN_EXPIRY || '24h',
   
   // Access Code Settings
   ACCESS_CODE_LENGTH: Number(env.HVNC_ACCESS_CODE_LENGTH) || 6,
   ACCESS_CODE_EXPIRY: env.HVNC_ACCESS_CODE_EXPIRY || '15m',
   
   // Session Settings
   MAX_SESSION_DURATION: env.HVNC_MAX_SESSION_DURATION || '8h',
   SESSION_IDLE_TIMEOUT: env.HVNC_SESSION_IDLE_TIMEOUT || '30m',
   
   // Shift Settings
   ENFORCE_SHIFTS: env.HVNC_ENFORCE_SHIFTS === 'true',
   SHIFT_START_TIME: env.HVNC_SHIFT_START_TIME || '09:00',
   SHIFT_END_TIME: env.HVNC_SHIFT_END_TIME || '17:00',
   SHIFT_TIMEZONE: env.HVNC_SHIFT_TIMEZONE || 'UTC',
   
   // Command Settings
   COMMAND_TIMEOUT: env.HVNC_COMMAND_TIMEOUT || '30s',
   COMMAND_RETRY_ATTEMPTS: Number(env.HVNC_COMMAND_RETRY_ATTEMPTS) || 3,
   
   // WebSocket Settings
   WEBSOCKET_PING_INTERVAL: Number(env.HVNC_WEBSOCKET_PING_INTERVAL) || 30000,
   WEBSOCKET_PING_TIMEOUT: Number(env.HVNC_WEBSOCKET_PING_TIMEOUT) || 5000,
   
   // Rate Limiting
   RATE_LIMIT_WINDOW: Number(env.HVNC_RATE_LIMIT_WINDOW) || 900000, // 15 minutes
   RATE_LIMIT_AUTH_MAX: Number(env.HVNC_RATE_LIMIT_AUTH_MAX) || 5,
   RATE_LIMIT_API_MAX: Number(env.HVNC_RATE_LIMIT_API_MAX) || 100,
   
   // Device Settings
   DEVICE_HEARTBEAT_INTERVAL: Number(env.HVNC_DEVICE_HEARTBEAT_INTERVAL) || 60000, // 1 minute
   DEVICE_OFFLINE_THRESHOLD: Number(env.HVNC_DEVICE_OFFLINE_THRESHOLD) || 180000, // 3 minutes
   
   // Admin Settings
   DEFAULT_ADMIN_EMAIL: env.HVNC_DEFAULT_ADMIN_EMAIL,
   DEFAULT_ADMIN_PASSWORD: env.HVNC_DEFAULT_ADMIN_PASSWORD,
   
   // Hubstaff Integration
   HUBSTAFF_ENABLED: env.HVNC_HUBSTAFF_ENABLED === 'true',
   HUBSTAFF_API_TOKEN: env.HVNC_HUBSTAFF_API_TOKEN,
   HUBSTAFF_ORGANIZATION_ID: env.HVNC_HUBSTAFF_ORGANIZATION_ID,
   
   // Logging
   ACTIVITY_LOG_RETENTION: env.HVNC_ACTIVITY_LOG_RETENTION || '90d',
   LOG_LEVEL: env.HVNC_LOG_LEVEL || 'info',
 },

};



module.exports = envConfig;
