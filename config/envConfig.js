const dotenv = require("dotenv");
const envSchema = require("./_schemas/envSchema");

// Default to development if NODE_ENV is not set
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "development" ? ".env.development" : ".env";

// Load environment variables from the appropriate file
dotenv.config({ path: envFile });

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

  mongo: {
    OLD_MONGO_URI: env.OLD_MONGO_URI,
    MONGO_URI: env.MONGO_URI,
    NEW_MONGODB_PASSWORD: env.NEW_MONGODB_PASSWORD,
  },

  jwt: {
    JWT_SECRET: env.JWT_SECRET,
  },

  email: {
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
    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: env.REDIS_PORT,
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

 NODE_ENV: env.NODE_ENV || nodeEnv,

 // Helper function to clean up swagger URLs (remove /api suffix if present)
 _cleanSwaggerUrl: (url) => {
   if (!url) return url;
   return url.replace(/\/api\/?$/, '');
 },

 // Use environment variable if available, otherwise fallback to computed URL
 get SWAGGER_URL() {
   const baseUrl = env.SWAGGER_BASE_URL || 
     (env.NODE_ENV === 'production' ? 'https://mydeeptech-be.onrender.com' : 'http://localhost:4000');
   return this._cleanSwaggerUrl(baseUrl);
 },

 // Enable/disable Swagger documentation
 SWAGGER_ENABLED: env.SWAGGER_ENABLED !== 'false', // Defaults to true unless explicitly disabled

};



module.exports = envConfig;
