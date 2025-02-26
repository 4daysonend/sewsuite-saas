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

  return config;
});