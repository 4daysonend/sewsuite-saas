// /backend/src/monitoring/services/metrics-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis, Redis } from '@nestjs/redis';

@Injectable()
export class MetricsCacheService {
  private readonly logger = new Logger(MetricsCacheService.name);
  private readonly CACHE_TTL = 60; // 60 seconds

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getCachedMetrics(key: string): Promise<any | null> {
    try {
      const cached = await this.redis.get(`metrics:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`Failed to get cached metrics: ${error.message}`);
      return null;
    }
  }

  async cacheMetrics(key: string, data: any): Promise<void> {
    try {
      await this.redis.setex(
        `metrics:${key}`,
        this.CACHE_TTL,
        JSON.stringify(data),
      );
    } catch (error) {
      this.logger.error(`Failed to cache metrics: ${error.message}`);
    }
  }

  generateCacheKey(timeframe: string, userId?: string): string {
    return `${timeframe}:${userId || 'system'}`;
  }
}