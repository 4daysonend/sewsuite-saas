// /backend/src/monitoring/services/monitoring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis, Redis } from '@nestjs/redis';
import { HealthService } from '../health/health.service';
import { MetricsCacheService } from './metrics-cache.service';
import { MonitoringGateway } from '../gateways/monitoring.gateway';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly healthService: HealthService,
    private readonly metricsCache: MetricsCacheService,
    private readonly monitoringGateway: MonitoringGateway,
  ) {
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.monitoringGateway.broadcastMetricsUpdate();
      } catch (error) {
        this.logger.error(`Metrics collection failed: ${error.message}`);
      }
    }, 5000); // Collect every 5 seconds
  }

  async getMetrics(timeframe: string, userId?: string): Promise<any> {
    const cacheKey = this.metricsCache.generateCacheKey(timeframe, userId);
    const cached = await this.metricsCache.getCachedMetrics(cacheKey);

    if (cached) {
      return cached;
    }

    const metrics = await this.collectMetrics(timeframe);
    await this.metricsCache.cacheMetrics(cacheKey, metrics);
    return metrics;
  }

  private async collectMetrics(timeframe?: string): Promise<any> {
    const [status, performance, queues, alerts] = await Promise.all([
      this.getSystemStatus(),
      this.getPerformanceMetrics(timeframe),
      this.getQueueMetrics(timeframe),
      this.getRecentAlerts(),
    ]);

    return {
      status,
      performance,
      queues,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }
}