// /backend/src/config/database.config.ts
import { registerAs } from '@nestjs/config';

interface PostgresConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface MongoConfig {
  uri: string;
}

interface RedisConfig {
  uri: string;
}

interface DatabaseConfig {
  postgres: PostgresConfig;
  mongodb: MongoConfig;
  redis: RedisConfig;
}

export default registerAs('database', (): DatabaseConfig => {
  // Validate critical environment variables
  const requiredEnvVars = [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
  ];

  if (process.env.NODE_ENV === 'production') {
    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );
    if (missingVars.length > 0) {
      throw new Error(
        `Critical database configuration missing: ${missingVars.join(', ')}`,
      );
    }
  }

  const config = {
    postgres: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER ?? '',
      password: process.env.POSTGRES_PASSWORD ?? '',
      database: process.env.POSTGRES_DB ?? '',
    },
    mongodb: {
      uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/default',
    },
    redis: {
      uri: process.env.REDIS_URI ?? 'redis://localhost:6379',
    },
  } satisfies DatabaseConfig;

  // Additional validation
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && (!config.postgres.username || !config.postgres.password)) {
    throw new Error('Database credentials missing in production environment');
  }

  return config;
});
