import Joi from "joi";

export const envSchema = Joi.object({
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
}).unknown(true); // allow other env vars like PATH, HOME, etc.
