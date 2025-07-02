import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ApiMetric } from './entities/api-metric.entity';
import { HealthService } from '../common/services/health.service';
import { MetricQueryDto } from './dto/metric-query.dto';
import * as os from 'os';
import { Alert } from './entities/alert.entity';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(ApiMetric)
    private readonly apiMetricRepository: Repository<ApiMetric>,
    @InjectRepository(Alert) // Add this line
    private readonly alertRepository: Repository<Alert>, // Add this line
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
      errors: await this.getRecentErrors(), // ✅ Added new method
    };
  }

  async getSystemStatus(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    const health = await this.healthService.checkHealth();
    return health.status;
  }

  async getMetricsSummary() {
    try {
      const metrics = await this.getPerformanceMetrics(
        Date.now() - 3600000,
        Date.now(),
      );
      return {
        status: await this.getSystemStatus(),
        metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get metrics summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async getRecentErrors(): Promise<any[]> {
    try {
      const data = await this.redis.zrevrange('metrics:errors', 0, 10); // Fetch last 10 errors
      return data.map((entry) => JSON.parse(entry));
    } catch (error) {
      this.logger.error(
        `Failed to get recent errors: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  async getErrorMetrics(
    component?: string,
    timeRange?: { startTime?: Date; endTime?: Date },
  ) {
    try {
      const startTime =
        timeRange?.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = timeRange?.endTime || new Date();

      const data = await this.redis.zrangebyscore(
        'metrics:errors',
        startTime.getTime(),
        endTime.getTime(),
      );

      return {
        total: data.length,
        byComponent: this.aggregateByComponent(data, component),
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get error metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async getUploadMetrics(query: MetricQueryDto) {
    try {
      const period = query.timeframe || '24h';
      const startTime =
        query.startTime ||
        new Date(Date.now() - this.getPeriodMilliseconds(period));
      const endTime = query.endTime || new Date();

      const data = await this.redis.zrangebyscore(
        'metrics:uploads',
        startTime.getTime(),
        endTime.getTime(),
      );

      return {
        total: data.length,
        successful: data.filter((d) => JSON.parse(d).status === 'success')
          .length,
        failed: data.filter((d) => JSON.parse(d).status === 'failed').length,
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get upload metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async getPerformanceMetrics(startTime: number, endTime: number) {
    try {
      const data = await this.redis.zrangebyscore(
        'metrics:performance',
        startTime,
        endTime,
      );

      return {
        cpu: this.calculateAverage(data.map((d) => JSON.parse(d).cpu)),
        memory: this.calculateAverage(data.map((d) => JSON.parse(d).memory)),
        loadAverage: this.calculateAverage(
          data.map((d) => JSON.parse(d).loadAverage),
        ),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async getQueueMetrics(timeframe: string): Promise<any> {
    try {
      const endTime = Date.now();
      const startTime = this.getStartTime(timeframe);

      const data = await this.redis.zrangebyscore(
        'metrics:queues',
        startTime,
        endTime,
      );

      // Parse the queue metrics and aggregate them
      const queueData = data.map((item) => JSON.parse(item));

      // Calculate metrics for all queues
      const result = {
        waiting: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        byQueue: {} as Record<
          string,
          {
            waiting: number;
            processing: number;
            completed: number;
            failed: number;
          }
        >,
        timestamp: new Date().toISOString(),
      };

      // Process queue data
      queueData.forEach((item) => {
        // Add to overall totals
        result.waiting += item.waiting || 0;
        result.processing += item.processing || 0;
        result.completed += item.completed || 0;
        result.failed += item.failed || 0;

        // Add to per-queue stats
        if (!result.byQueue[item.queue]) {
          result.byQueue[item.queue] = {
            waiting: 0,
            processing: 0,
            completed: 0,
            failed: 0,
          };
        }

        result.byQueue[item.queue].waiting += item.waiting || 0;
        result.byQueue[item.queue].processing += item.processing || 0;
        result.byQueue[item.queue].completed += item.completed || 0;
        result.byQueue[item.queue].failed += item.failed || 0;
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get queue metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Return empty queue metrics on error
      return {
        waiting: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        byQueue: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getRecentAlerts(): Promise<any[]> {
    try {
      const data = await this.redis.zrevrange('metrics:alerts', 0, 10); // Fetch the 10 most recent alerts
      return data.map((entry) => JSON.parse(entry));
    } catch (error) {
      this.logger.error(
        `Failed to get recent alerts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  async getAPIMetrics(query: MetricQueryDto): Promise<any> {
    try {
      const { timeframe = '1h' } = query;
      const { startTime, endTime } = this.getTimeRangeFromQuery(query);

      this.logger.log(`Fetching API metrics for timeframe: ${timeframe}`);

      const cacheKey = `api-metrics:${timeframe}:${startTime.toISOString()}:${endTime.toISOString()}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const apiMetrics = await this.apiMetricRepository.find({
        where: {
          timestamp: Between(startTime, endTime),
        },
      });

      if (!apiMetrics.length) {
        return {
          requestCount: 0,
          averageResponseTime: 0,
          errorRate: 0,
          topEndpoints: [],
          timeRange: {
            start: startTime,
            end: endTime,
          },
        };
      }

      // Calculate overall metrics
      const requestCount = apiMetrics.length;
      const responseTimeValues = apiMetrics.map((m) => m.responseTime);
      const averageResponseTime = this.calculateAverage(responseTimeValues);

      // Count errors (status code >= 400)
      const errorCount = apiMetrics.filter((m) => m.statusCode >= 400).length;
      const errorRate =
        requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

      // Group by endpoint to find top endpoints
      const endpointMap = new Map();

      apiMetrics.forEach((item) => {
        const key = `${item.method}:${item.path}`;

        if (!endpointMap.has(key)) {
          endpointMap.set(key, {
            path: item.path,
            method: item.method,
            count: 0,
            totalTime: 0,
            errors: 0,
          });
        }

        const endpoint = endpointMap.get(key);
        endpoint.count += 1;
        endpoint.totalTime += item.responseTime;
        if (item.statusCode >= 400) {
          endpoint.errors += 1;
        }
      });

      // Transform to array and calculate averages
      const topEndpoints = Array.from(endpointMap.values())
        .map((e) => ({
          path: e.path,
          method: e.method,
          count: e.count,
          averageResponseTime: e.count > 0 ? e.totalTime / e.count : 0,
          errorRate: e.count > 0 ? (e.errors / e.count) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const result = {
        requestCount,
        averageResponseTime,
        errorRate,
        topEndpoints,
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };

      // Cache the results
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get API metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Return default structure on error
      return {
        requestCount: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topEndpoints: [],
        timeRange: {
          start: new Date(),
          end: new Date(),
        },
        error: 'Failed to retrieve API metrics',
      };
    }
  }

  async getHealthStatus(): Promise<any> {
    try {
      // Get current system metrics
      const cpuUsage = this.getCpuUsage();
      const memoryUsage = this.getMemoryUsage();

      // Determine system status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (cpuUsage > 90 || memoryUsage > 90) {
        status = 'unhealthy';
      } else if (cpuUsage > 70 || memoryUsage > 70) {
        status = 'degraded';
      }

      return {
        status,
        components: {
          cpu: {
            status: this.getComponentStatus(cpuUsage),
            usage: cpuUsage,
            cores: os.cpus().length,
          },
          memory: {
            status: this.getComponentStatus(memoryUsage),
            total: os.totalmem(),
            free: os.freemem(),
            usage: memoryUsage,
          },
          database: await this.checkDatabaseHealth(),
          cache: await this.checkRedisHealth(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to check health: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getAlerts(query: MetricQueryDto): Promise<any> {
    try {
      const { timeframe = '24h', component } = query;
      const { startTime, endTime } = this.getTimeRangeFromQuery(query);

      const cacheKey = `alerts:${timeframe}:${component || 'all'}`;
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Query alerts from database
      let queryBuilder = this.alertRepository
        .createQueryBuilder('alert')
        .where('alert.timestamp BETWEEN :startTime AND :endTime', {
          startTime,
          endTime,
        });

      if (component) {
        queryBuilder = queryBuilder.andWhere('alert.component = :component', {
          component,
        });
      }

      const alerts = await queryBuilder.getMany();

      // Group by status and severity
      const byStatus = {
        active: alerts.filter((a) => a.status === 'active').length,
        resolved: alerts.filter((a) => a.status === 'resolved').length,
      };

      const bySeverity = {
        high: alerts.filter((a) => a.severity === 'high').length,
        medium: alerts.filter((a) => a.severity === 'medium').length,
        low: alerts.filter((a) => a.severity === 'low').length,
      };

      // Get the 10 most recent alerts
      const recent = [...alerts]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 10);

      const result = {
        total: alerts.length,
        byStatus,
        bySeverity,
        recent,
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };

      // Cache the results
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get alerts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        total: 0,
        byStatus: { active: 0, resolved: 0 },
        bySeverity: { high: 0, medium: 0, low: 0 },
        recent: [],
        timeRange: {
          start: new Date(),
          end: new Date(),
        },
        error: 'Failed to retrieve alerts',
      };
    }
  }

  private getStartTime(timeframe: string): number {
    const now = Date.now();
    switch (timeframe) {
      case '5m':
        return now - 5 * 60 * 1000;
      case '1h':
        return now - 60 * 60 * 1000;
      case '24h':
        return now - 24 * 60 * 60 * 1000;
      case '7d':
        return now - 7 * 24 * 60 * 60 * 1000;
      default:
        return now - 60 * 60 * 1000; // Default to 1h
    }
  }

  private getPeriodMilliseconds(period: string): number {
    const periods: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return periods[period] || periods['24h'];
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.length
      ? numbers.reduce((a, b) => a + b, 0) / numbers.length
      : 0;
  }

  private aggregateByComponent(
    data: string[],
    component?: string,
  ): Record<string, number> {
    return data.reduce(
      (acc, curr) => {
        const parsed = JSON.parse(curr);
        if (component && parsed.component !== component) return acc;
        acc[parsed.component] = (acc[parsed.component] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private getTimeRangeFromQuery(query: MetricQueryDto): {
    startTime: Date;
    endTime: Date;
  } {
    const { timeframe = '24h', startTime, endTime } = query;

    return {
      startTime:
        startTime ||
        new Date(Date.now() - this.getPeriodMilliseconds(timeframe)),
      endTime: endTime || new Date(),
    };
  }

  private getComponentStatus(
    usage: number,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (usage > 90) return 'unhealthy';
    if (usage > 70) return 'degraded';
    return 'healthy';
  }

  private getCpuUsage(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      // Type-safe approach using explicit properties
      const times = cpu.times;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
      idle += times.idle;
    }

    return Math.floor((1 - idle / total) * 100);
  }

  private getMemoryUsage(): number {
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    return Math.floor(((totalMem - freeMem) / totalMem) * 100);
  }

  private async checkDatabaseHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      // Replace with actual database check if you have one
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  private async checkRedisHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      // Simple ping test
      await this.redis.ping();
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}
