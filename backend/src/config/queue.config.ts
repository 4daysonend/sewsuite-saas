// /backend/src/config/queue.config.ts
import { BullModuleOptions } from '@nestjs/bull';

type QueueBackoffType = 'exponential' | 'fixed';

interface QueueBackoffOptions {
  type: QueueBackoffType;
  delay: number;
}

interface QueueJobOptions {
  attempts: number;
  backoff: QueueBackoffOptions;
  removeOnComplete: boolean;
  timeout: number;
}

export const queueConfig: BullModuleOptions = {
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    timeout: 5000,
  } satisfies QueueJobOptions,
} as const;