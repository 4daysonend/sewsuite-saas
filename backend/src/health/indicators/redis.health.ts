import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: any;

  constructor(private readonly configService: ConfigService) {
    super();
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB') || 0,
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
  }

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    try {
      // Connect if not connected
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }

      // Try setting and getting a value
      const testKey = `health:${Date.now()}`;
      await this.redis.set(testKey, 'ok');
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);

      // Check if the test was successful
      if (value !== 'ok') {
        throw new Error('Redis health check failed: value mismatch');
      }

      // Include some useful metrics
      const info = await this.redis.info();

      const metrics: Record<string, string | number> = {};
      if (info) {
        const lines = info.split('\n');
        for (const line of lines) {
          if (line.includes('used_memory_human')) {
            metrics['memory'] = line.split(':')[1].trim();
          }
          if (line.includes('connected_clients')) {
            metrics['clients'] = parseInt(line.split(':')[1].trim(), 10);
          }
          if (line.includes('uptime_in_seconds')) {
            metrics['uptime'] = parseInt(line.split(':')[1].trim(), 10);
          }
        }
      }

      return this.getStatus(key, true, { metrics });
    } catch (error: unknown) {
      const err = error as Error;
      throw new HealthCheckError(
        `Redis health check failed: ${err.message}`,
        this.getStatus(key, false, {
          error: err.message,
          stack: err.stack,
        }),
      );
    }
  }
}
