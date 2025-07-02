import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().uri().required(),

  // PostgreSQL
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),

  // MongoDB
  MONGODB_URI: Joi.string().required(),
  MONGODB_DATABASE: Joi.string().when('MONGODB_URI', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  MONGODB_USER: Joi.string().when('MONGODB_URI', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  MONGODB_PASSWORD: Joi.string().when('MONGODB_URI', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  MONGODB_PORT: Joi.number().default(27017),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_URI: Joi.string().optional(),

  // RabbitMQ
  RABBITMQ_USER: Joi.string().required(),
  RABBITMQ_PASSWORD: Joi.string().required(),
  RABBITMQ_PORT: Joi.number().default(5672),
  RABBITMQ_MANAGEMENT_PORT: Joi.number().default(15672),

  // Bull Queue
  QUEUE_REDIS_HOST: Joi.string().default('localhost'),
  QUEUE_REDIS_PORT: Joi.number().default(6379),
  QUEUE_REDIS_PASSWORD: Joi.string().allow('').default(''),
  QUEUE_REDIS_DB: Joi.number().default(1),

  // JWT Auth
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('24h'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(10),

  // Google OAuth (optional but validated if provided)
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().when('GOOGLE_CLIENT_ID', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  GOOGLE_CALLBACK_URL: Joi.string().uri().when('GOOGLE_CLIENT_ID', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // AWS S3/MinIO
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET_NAME: Joi.string().required(),
  S3_ENDPOINT: Joi.string().optional(), // For MinIO
  MINIO_API_PORT: Joi.number().default(9000),
  MINIO_CONSOLE_PORT: Joi.number().default(9001),

  // Nginx
  NGINX_HTTP_PORT: Joi.number().default(80),
  NGINX_HTTPS_PORT: Joi.number().default(443),

  // Email
  EMAIL_SERVICE: Joi.string().required(),
  EMAIL_USER: Joi.string().required(),
  EMAIL_PASSWORD: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // Rate Limiting
  RATE_LIMIT_WINDOW: Joi.number().default(15),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(5 * 1024 * 1024), // 5MB
  ALLOWED_FILE_TYPES: Joi.string().default(
    'image/jpeg,image/png,application/pdf',
  ),
  MAX_FILES_PER_REQUEST: Joi.number().default(5),

  // Monitoring
  ENABLE_MONITORING: Joi.boolean().default(true),
  METRICS_INTERVAL: Joi.number().default(60000),
  PROMETHEUS_PORT: Joi.number().default(9090),
  GRAFANA_PORT: Joi.number().default(3000),

  // Cache
  CACHE_TTL: Joi.number().default(3600),
  CACHE_MAX_ITEMS: Joi.number().default(1000),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  LOG_FILE_PATH: Joi.string().default('logs/app.log'),
}).unknown();
