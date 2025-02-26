import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().required(),

  // PostgreSQL
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),

  // MongoDB
  MONGODB_URI: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_URI: Joi.string().required(),

  // Bull Queue
  QUEUE_REDIS_HOST: Joi.string().required(),
  QUEUE_REDIS_PORT: Joi.number().default(6379),
  QUEUE_REDIS_PASSWORD: Joi.string().allow('').default(''),
  QUEUE_REDIS_DB: Joi.number().default(1),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('24h'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(10),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().required(),

  // AWS
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_S3_BUCKET: Joi.string().required(),

  // Email
  EMAIL_SERVICE: Joi.string().required(),
  EMAIL_USER: Joi.string().required(),
  EMAIL_PASSWORD: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // Rate Limiting
  RATE_LIMIT_WINDOW: Joi.number().default(15),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(5242880),
  ALLOWED_FILE_TYPES: Joi.string().default(
    'image/jpeg,image/png,application/pdf',
  ),
  MAX_FILES_PER_REQUEST: Joi.number().default(5),

  // Monitoring
  ENABLE_MONITORING: Joi.boolean().default(true),
  METRICS_INTERVAL: Joi.number().default(60000),

  // Cache
  CACHE_TTL: Joi.number().default(3600),
  CACHE_MAX_ITEMS: Joi.number().default(1000),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_FILE_PATH: Joi.string().default('logs/app.log'),
});
