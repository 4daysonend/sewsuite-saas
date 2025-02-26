// /backend/src/monitoring/monitoring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis, Redis } from '@nestjs/redis';
import { HealthService } from '../common/health/health.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly healthService: HealthService,
  ) {}

  async getMetrics(timeframe: string) {
    const endTime = Date.now();
    const startTime = this.getStartTime(timeframe);

    return {
      status: await this.getSystemStatus(),
      performance: await this.getPerformanceMetrics(startTime, endTime),
      queues: await this.getQueueMetrics(timeframe),
      alerts: await this.getRecentAlerts(),
    };
  }

  async getSystemStatus(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    const health = await this.healthService.checkHealth();
    return health.status;
  }

  async getMetricsSummary() {
    try {
      const metrics = await this.getPerformanceMetrics(Date.now() - 3600000, Date.now());
      return {
        status: await this.getSystemStatus(),
        metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getErrorMetrics(component?: string, timeRange?: { startTime?: Date; endTime?: Date }) {
    try {
      const startTime = timeRange?.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = timeRange?.endTime || new Date();

      const data = await this.redis.zrangebyscore(
        'metrics:errors',
        startTime.getTime(),
        endTime.getTime()
      );

      return {
        total: data.length,
        byComponent: this.aggregateByComponent(data, component),
        timeRange: {
          start: startTime,
          end: endTime
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get error metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getUploadMetrics(options: { period: string; startTime?: Date; endTime?: Date }) {
    try {
      const startTime = options.startTime || new Date(Date.now() - this.getPeriodMilliseconds(options.period));
      const endTime = options.endTime || new Date();

      const data = await this.redis.zrangebyscore(
        'metrics:uploads',
        startTime.getTime(),
        endTime.getTime()
      );

      return {
        total: data.length,
        successful: data.filter(d => JSON.parse(d).status === 'success').length,
        failed: data.filter(d => JSON.parse(d).status === 'failed').length,
        timeRange: {
          start: startTime,
          end: endTime
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get upload metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getAPIMetrics(path?: string, method?: string, timeframe: string = '1h') {
    try {
      const data = await this.redis.zrangebyscore(
        'metrics:api',
        this.getStartTime(timeframe),
        Date.now()
      );

      const filtered = data
        .map(d => JSON.parse(d))
        .filter(d => {
          if (path && d.path !== path) return false;
          if (method && d.method !== method) return false;
          return true;
        });

      return {
        total: filtered.length,
        averageResponseTime: this.calculateAverage(filtered.map(d => d.responseTime)),
        byPath: this.aggregateByPath(filtered),
        byMethod: this.aggregateByMethod(filtered)
      };
    } catch (error) {
      this.logger.error(`Failed to get API metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getAlerts(options: { status?: string; severity?: string; limit: number }) {
    try {
      let alerts = await this.redis.zrevrange('alerts', 0, options.limit - 1);
      alerts = alerts.map(a => JSON.parse(a));

      if (options.status) {
        alerts = alerts.filter(a => a.status === options.status);
      }
      if (options.severity) {
        alerts = alerts.filter(a => a.severity === options.severity);
      }

      return alerts;
    } catch (error) {
      this.logger.error(`Failed to get alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getPerformanceMetrics(startTime: number, endTime: number) {
    try {
      const data = await this.redis.zrangebyscore(
        'metrics:performance',
        startTime,
        endTime
      );

      return {
        cpu: this.calculateAverage(data.map(d => JSON.parse(d).cpu)),
        memory: this.calculateAverage(data.map(d => JSON.parse(d).memory)),
        loadAverage: this.calculateAverage(data.map(d => JSON.parse(d).loadAverage)),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to get performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private getStartTime(timeframe: string): number {
    const now = Date.now();
    switch (timeframe) {
      case '5m': return now - 5 * 60 * 1000;
      case '1h': return now - 60 * 60 * 1000;
      case '24h': return now - 24 * 60 * 60 * 1000;
      case '7d': return now - 7 * 24 * 60 * 60 * 1000;
      default: return now - 60 * 60 * 1000; // Default to 1h
    }
  }

  private getPeriodMilliseconds(period: string): number {
    const periods: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return periods[period] || periods['24h'];
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  private aggregateByComponent(data: string[], component?: string): Record<string, number> {
    return data.reduce((acc, curr) => {
      const parsed = JSON.parse(curr);
      if (component && parsed.component !== component) return acc;
      acc[parsed.component] = (acc[parsed.component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateByPath(data: any[]): Record<string, number> {
    return data.reduce((acc, curr) => {
      acc[curr.path] = (acc[curr.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateByMethod(data: any[]): Record<string, number> {
    return data.reduce((acc, curr) => {
      acc[curr.method] = (acc[curr.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}