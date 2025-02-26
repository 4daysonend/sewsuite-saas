import { registerAs } from '@nestjs/config';

// TypeScript 5.3.3 type definitions for configuration
interface DatabaseConfig {
  postgres: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize?: boolean;
    logging?: boolean | string[];
  };
  mongodb: {
    uri: string;
  };
}

interface AppConfig {
  port: number;
  frontendUrl: string;
}

interface RedisConfig {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
}

interface QueueConfig {
  redis: RedisConfig;
}

interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
}

interface AwsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  s3Bucket: string;
}

interface EmailConfig {
  service: string;
  user: string;
  password: string;
  from: string;
}

interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

interface UploadConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  maxFilesPerRequest: number;
}

interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
}

interface CacheConfig {
  ttl: number;
  maxItems: number;
}

interface LoggingConfig {
  level: string;
  filePath: string;
}

interface EnvironmentConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  queue: QueueConfig;
  auth: AuthConfig;
  aws: AwsConfig;
  email: EmailConfig;
  security: SecurityConfig;
  upload: UploadConfig;
  monitoring: MonitoringConfig;
  cache: CacheConfig;
  logging: LoggingConfig;
}

const baseConfig = {
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
  database: {
    postgres: {
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    },
    mongodb: {
      uri: process.env.MONGODB_URI,
    },
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  },
  queue: {
    redis: {
      host: process.env.QUEUE_REDIS_HOST,
      port: parseInt(process.env.QUEUE_REDIS_PORT ?? '6379', 10),
      password: process.env.QUEUE_REDIS_PASSWORD,
      db: parseInt(process.env.QUEUE_REDIS_DB ?? '1', 10),
    },
  },
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      expiresIn: process.env.JWT_EXPIRATION ?? '1h',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
    },
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    region: process.env.AWS_REGION ?? '',
    s3Bucket: process.env.AWS_S3_BUCKET ?? '',
  },
  email: {
    service: process.env.EMAIL_SERVICE ?? '',
    user: process.env.EMAIL_USER ?? '',
    password: process.env.EMAIL_PASSWORD ?? '',
    from: process.env.EMAIL_FROM ?? '',
  },
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW ?? '15') * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
    },
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10),
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') ?? [],
    maxFilesPerRequest: parseInt(process.env.MAX_FILES_PER_REQUEST ?? '5', 10),
  },
  monitoring: {
    enabled: process.env.ENABLE_MONITORING === 'true',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL ?? '60000', 10),
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL ?? '3600', 10),
    maxItems: parseInt(process.env.CACHE_MAX_ITEMS ?? '1000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
    filePath: process.env.LOG_FILE_PATH ?? 'logs/app.log',
  },
} satisfies EnvironmentConfig;

const environmentConfigs = {
  development: {
    ...baseConfig,
    database: {
      ...baseConfig.database,
      postgres: {
        ...baseConfig.database.postgres,
        synchronize: true,
        logging: true,
      },
    },
    logging: {
      ...baseConfig.logging,
      level: 'debug',
    },
  },
  staging: {
    ...baseConfig,
    database: {
      ...baseConfig.database,
      postgres: {
        ...baseConfig.database.postgres,
        synchronize: false,
        logging: ['error', 'warn'],
      },
    },
    logging: {
      ...baseConfig.logging,
      level: 'info',
    },
  },
  production: {
    ...baseConfig,
    database: {
      ...baseConfig.database,
      postgres: {
        ...baseConfig.database.postgres,
        synchronize: false,
        logging: ['error'],
      },
    },
    logging: {
      ...baseConfig.logging,
      level: 'warn',
    },
  },
} as const;

export const configuration = () => {
  const environment = (process.env.NODE_ENV ?? 'development') as keyof typeof environmentConfigs;
  return environmentConfigs[environment];
};

export const databaseConfig = registerAs('database', () => configuration().database);
export const redisConfig = registerAs('redis', () => configuration().redis);
export const queueConfig = registerAs('queue', () => configuration().queue);
export const authConfig = registerAs('auth', () => configuration().auth);
export const awsConfig = registerAs('aws', () => configuration().aws);
export const emailConfig = registerAs('email', () => configuration().email);
export const securityConfig = registerAs('security', () => configuration().security);
export const uploadConfig = registerAs('upload', () => configuration().upload);
export const monitoringConfig = registerAs('monitoring', () => configuration().monitoring);
export const cacheConfig = registerAs('cache', () => configuration().cache);
export const loggingConfig = registerAs('logging', () => configuration().logging);