// /backend/src/monitoring/services/metrics-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class MetricsCacheService {
  private readonly logger = new Logger(MetricsCacheService.name);
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a cache key for metrics
   */
  generateCacheKey(prefix: string, suffix?: string): string {
    return `metrics:${prefix}:${suffix || 'all'}`;
  }

  /**
   * Get cached metrics data
   */
  async getCachedMetrics(key: string): Promise<any | null> {
    try {
      const data = await this.redisService.get(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(
        `Failed to get cached metrics: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Cache metrics data
   */
  async cacheMetrics(
    key: string,
    data: any,
    ttl = this.DEFAULT_TTL,
  ): Promise<void> {
    try {
      await this.redisService.set(key, JSON.stringify(data), ttl);
    } catch (error) {
      this.logger.error(`Failed to cache metrics: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate cached metrics
   */
  async invalidateCache(keyPattern: string): Promise<void> {
    try {
      // This would ideally use a Redis SCAN operation in production
      // For simplicity, we're using a direct key deletion
      await this.redisService.del(keyPattern);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache: ${(error as Error).message}`,
      );
    }
  }
}
