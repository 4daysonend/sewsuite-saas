import {
  Injectable,
  Logger,
  InternalServerErrorException,
  forwardRef,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MetricQueryDto } from '../dto/metric-query.dto';
import { SystemMetrics } from '../interfaces/metrics.interface';
import { ApiMetric } from '../entities/api-metric.entity';
import { SystemMetric } from '../entities/system-metric.entity';
import { SystemError } from '../entities/system-error.entity';
import { Alert } from '../entities/alert.entity';
import { FileUpload } from '../entities/file-upload.entity';
import { RedisService } from '../../common/services/redis.service';
import * as os from 'os';
import { AlertSeverity } from '../types/alert.types';
import { ConnectionsManager } from '../../common/services/connections-manager.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(ApiMetric)
    private readonly apiMetricRepository: Repository<ApiMetric>,
    private readonly systemMetricRepository: Repository<SystemMetric>,
    @InjectRepository(SystemError)
    private readonly systemErrorRepository: Repository<SystemError>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(FileUpload)
    private readonly fileUploadRepository: Repository<FileUpload>,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => ConnectionsManager))
    private readonly connectionsManager?: ConnectionsManager,
    @Optional() @InjectQueue('your-queue-name') private jobQueue?: Queue, // Optional
  ) {
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        this.logger.debug('System metrics collected successfully');
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(
            `Failed to collect system metrics: ${error.message}`,
          );
        } else {
          this.logger.error('Failed to collect system metrics: Unknown error');
        }
      }
    }, 60000); // Collect every minute
  }

  async getAPIMetrics(
    query: MetricQueryDto,
  ): Promise<SystemMetrics['api'] & { timeRange: { start: Date; end: Date } }> {
    try {
      const { timeframe = '1h' } = query;
      const startTime =
        query.startTime ||
        new Date(Date.now() - this.getPeriodMilliseconds(timeframe));
      const endTime = query.endTime || new Date();

      this.logger.log(`Fetching API metrics for timeframe: ${timeframe}`);

      const cacheKey = `api-metrics:${timeframe}:${startTime.toISOString()}:${endTime.toISOString()}`;
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const data = await this.redisService.get(
        `metrics:api:${startTime.getTime()}:${endTime.getTime()}`,
      );

      if (!data) {
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

      const parsedData = JSON.parse(data);
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
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

      const apiData = parsedData.map((item) => JSON.parse(item));

      // Calculate metrics
      const requestCount = apiData.length;

      const responseTimeTotal = apiData.reduce(
        (total, item) => total + (item.responseTime || 0),
        0,
      );

      const averageResponseTime =
        requestCount > 0 ? responseTimeTotal / requestCount : 0;

      const errorCount = apiData.filter(
        (item) => item.statusCode >= 400,
      ).length;

      const errorRate =
        requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

      // Group by path and method
      const endpointMap = new Map();
      apiData.forEach((item) => {
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
        endpoint.totalTime += item.responseTime || 0;
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

      // Process metrics with your error rate calculation
      const processedMetrics = apiData.map((item) => ({
        path: item.path,
        method: item.method,
        count: 1,
        avgStatusCode: item.statusCode,
      }));

      // Use the calculateErrorRate method here
      const calculatedErrorRate = this.calculateErrorRate(processedMetrics);

      // Compare with your existing error rate calculation
      this.logger.debug(
        `Calculated error rate: ${calculatedErrorRate}, Direct error rate: ${errorRate}`,
      );

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
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        300, // Cache for 5 minutes
      );

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
      };
    }
  }

  async getMetrics(query: MetricQueryDto): Promise<SystemMetrics> {
    const { timeframe = '24h' } = query;
    const cacheKey = `metrics:${timeframe}`;
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const { startTime, endTime } = this.getTimeRangeFromQuery(query);

    const [apiMetrics, systemMetrics, errors, alerts] = await Promise.all([
      this.getAPIMetrics(query),
      this.getSystemMetricsData(startTime, endTime),
      this.getErrorMetricsData(startTime, endTime),
      this.getAlertsData(startTime, endTime),
    ]);

    const metrics = {
      api: apiMetrics,
      system: systemMetrics,
      errors,
      alerts,
      timestamp: new Date().toISOString(),
    };

    await this.redisService.set(cacheKey, JSON.stringify(metrics), 300);
    return metrics;
  }

  async getMetricsSummary(): Promise<any> {
    const cacheKey = 'metrics:summary';
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const [apiMetrics, systemStatus, activeAlerts] = await Promise.all([
      this.getAPIMetrics({ timeframe: '1h' }), // Pass an object that matches MetricQueryDto
      this.getSystemStatus(),
      this.alertRepository.count({ where: { status: 'active' } }),
    ]);

    const summary = {
      status: systemStatus.status,
      errorRate: apiMetrics.errorRate,
      requestCount: apiMetrics.requestCount,
      averageResponseTime: apiMetrics.averageResponseTime,
      activeAlerts,
      timestamp: new Date().toISOString(),
    };

    await this.redisService.set(cacheKey, JSON.stringify(summary), 60); // Cache for 1 minute
    return summary;
  }

  async getErrorMetrics(query: MetricQueryDto): Promise<any> {
    const { component } = query;
    const { startTime, endTime } = this.getTimeRangeFromQuery(query);

    if (!startTime || !endTime) {
      throw new Error('Invalid time range');
    }

    const cacheKey = `error-metrics:${component}:${startTime.toISOString()}:${endTime.toISOString()}`;
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    let queryBuilder = this.systemErrorRepository
      .createQueryBuilder('error')
      .where('error.timestamp BETWEEN :startTime AND :endTime', {
        startTime,
        endTime,
      });

    if (component) {
      queryBuilder = queryBuilder.andWhere('error.component = :component', {
        component,
      });
    }

    const errors = await queryBuilder.getMany();

    // Define an interface for the error data structure
    interface ErrorTypeData {
      count: number;
      errors: SystemError[];
    }

    // Group errors by type with proper typing
    const errorsByType: { [key: string]: ErrorTypeData } = errors.reduce(
      (acc: { [key: string]: ErrorTypeData }, error) => {
        if (!acc[error.type]) {
          acc[error.type] = {
            count: 0,
            errors: [],
          };
        }
        acc[error.type].count++;
        acc[error.type].errors.push(error);
        return acc;
      },
      {},
    );

    const result = {
      total: errors.length,
      byType: Object.entries(errorsByType).map(
        ([type, data]: [string, ErrorTypeData]) => ({
          type,
          count: (data as ErrorTypeData).count,
          percentage: (data.count / Math.max(1, errors.length)) * 100,
          recentErrors: data.errors
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            )
            .slice(0, 5),
        }),
      ),
      timeRange: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    };

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getHealthStatus(): Promise<any> {
    const cacheKey = 'health:status';
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Get real-time system stats
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce(
          (sum, time) => sum + time,
          0,
        );
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    const memoryUsage = (usedMemory / totalMemory) * 100;

    // Determine status based on resource usage
    const cpuStatus =
      cpuUsage > 90 ? 'critical' : cpuUsage > 70 ? 'warning' : 'healthy';
    const memoryStatus =
      memoryUsage > 90 ? 'critical' : memoryUsage > 70 ? 'warning' : 'healthy';

    // Check database connection
    let dbStatus = 'healthy';
    try {
      await this.apiMetricRepository.count({ take: 1 });
    } catch (error) {
      dbStatus = 'critical';
      this.logger.error(
        `Database health check failed: ${(error as Error).message}`,
      );
    }

    // Check Redis connection
    let redisStatus = 'healthy';
    try {
      await this.redisService.get('health:check');
    } catch (error) {
      redisStatus = 'critical';
      this.logger.error(
        `Redis health check failed: ${(error as Error).message}`,
      );
    }

    // Determine overall system status (worst status wins)
    const statuses = [cpuStatus, memoryStatus, dbStatus, redisStatus];
    let overallStatus = 'healthy';
    if (statuses.includes('critical')) {
      overallStatus = 'critical';
    } else if (statuses.includes('warning')) {
      overallStatus = 'warning';
    }

    const result = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        cpu: {
          status: cpuStatus,
          usage: parseFloat(cpuUsage.toFixed(2)),
          cores: cpus.length,
        },
        memory: {
          status: memoryStatus,
          total: Math.round(totalMemory / 1024 / 1024),
          used: Math.round(usedMemory / 1024 / 1024),
          usage: parseFloat(memoryUsage.toFixed(2)),
        },
        database: {
          status: dbStatus,
        },
        redis: {
          status: redisStatus,
        },
      },
    };

    // Cache health status briefly
    await this.redisService.set(cacheKey, JSON.stringify(result), 15); // Cache for 15 seconds

    return result;
  }

  async getPerformanceMetrics(
    timeframe: string,
    timeframeMs?: number,
  ): Promise<any> {
    // If timeframeMs is provided, use the detailed metrics implementation
    if (timeframeMs !== undefined) {
      try {
        // Get system metrics for the specified timeframe
        const cpuUsage = await this.calculateAverageCpuUsage(timeframeMs);
        const memoryUsage = await this.calculateAverageMemoryUsage(timeframeMs);
        const requestRate = await this.calculateRequestRate(timeframeMs);
        const responseTime =
          await this.calculateAverageResponseTime(timeframeMs);

        // Collect server health statistics
        const activeConnections = await this.getActiveConnections();
        const queuedJobs = await this.getQueuedJobs();

        // Log for monitoring purposes
        this.logger.log(
          `Performance metrics retrieved for timeframe: ${timeframe} (${timeframeMs}ms)`,
        );

        return {
          timeframe, // Include the original human-readable timeframe
          metrics: {
            cpu: {
              usage: cpuUsage,
              threshold: 80, // Default CPU threshold
            },
            memory: {
              usage: memoryUsage,
              total: os.totalmem() / (1024 * 1024), // Convert to MB
              threshold: 85, // Default memory threshold
            },
            system: {
              activeConnections,
              queuedJobs,
              uptime: process.uptime(),
            },
            performance: {
              requestRate,
              responseTime,
            },
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Failed to retrieve performance metrics: ${errorMessage}`,
          errorStack,
        );
        throw new InternalServerErrorException(
          'Failed to retrieve performance metrics',
          { cause: error },
        );
      }
    } else {
      // Use the original implementation for timeframe-only calls
      const cacheKey = `performance:${timeframe}`;
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const { startTime, endTime } = this.getStartTimeFromTimeframe(timeframe);

      // Get historical system metrics
      const systemMetrics = await this.systemMetricRepository.find({
        where: {
          timestamp: Between(startTime, endTime),
        },
        order: {
          timestamp: 'ASC',
        },
      });

      // Get current system metrics
      const currentMetrics = {
        cpu: parseFloat(
          ((1 - os.loadavg()[0] / os.cpus().length) * 100).toFixed(2),
        ),
        memory: parseFloat(
          (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
        ),
        uptime: os.uptime(),
      };

      // Process historical data for time series visualization
      const processedMetrics = this.processTimeSeriesData(systemMetrics);

      const result = {
        current: currentMetrics,
        historical: processedMetrics,
        timeframe,
        timeRange: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      };

      await this.redisService.set(cacheKey, JSON.stringify(result), 60);
      return result;
    }
  }

  async getAlerts(query: MetricQueryDto): Promise<any> {
    try {
      const { timeframe = '24h', component } = query;
      const startTime =
        query.startTime ||
        new Date(Date.now() - this.getPeriodMilliseconds(timeframe));
      const endTime = query.endTime || new Date();

      const cacheKey = `alerts:${timeframe}:${component || 'all'}`;
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Get alerts from the sorted set
      const data =
        (await this.redisService.getListByRange(
          'metrics:alerts',
          startTime.getTime(),
          endTime.getTime(),
        )) || [];

      const alerts = data.map((item) => JSON.parse(item));

      // Filter by component if specified
      const filtered = component
        ? alerts.filter((alert) => alert.component === component)
        : alerts;

      // Group by severity and status
      const byStatus = {
        active: filtered.filter((a) => a.status === 'active').length,
        resolved: filtered.filter((a) => a.status === 'resolved').length,
      };

      const bySeverity = {
        high: filtered.filter((a) => a.severity === 'high').length,
        medium: filtered.filter((a) => a.severity === 'medium').length,
        low: filtered.filter((a) => a.severity === 'low').length,
      };

      // Get the 10 most recent alerts
      const recent = [...filtered]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 10);

      const result = {
        total: filtered.length,
        byStatus,
        bySeverity,
        recent,
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };

      // Cache the results
      await this.redisService.set(cacheKey, JSON.stringify(result), 300);

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

  /**
   * Get file upload metrics with filtering options
   * @param options Options for filtering upload metrics
   * @returns Metrics and statistics about file uploads
   */
  async getUploadMetrics(query: MetricQueryDto): Promise<any> {
    const {
      timeframe = '24h',
      fileType,
      startTime: queryStartTime,
      endTime: queryEndTime,
    } = query;

    this.logger.debug(
      `Getting upload metrics with options: ${JSON.stringify(query)}`,
    );

    const cacheKey = `upload-metrics:${timeframe}:${fileType || 'all'}:${
      queryStartTime?.toISOString() || ''
    }:${queryEndTime?.toISOString() || ''}`;

    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const { startTime, endTime } = this.getTimeRangeFromQuery(query);

    const uploadMetrics = await this.fetchUploadMetricsFromStorage(
      startTime,
      endTime,
    );

    let filteredMetrics = uploadMetrics;

    if (fileType) {
      filteredMetrics = {
        ...uploadMetrics,
        totalUploads: uploadMetrics.fileTypes[fileType] || 0,
        fileTypes: { [fileType]: uploadMetrics.fileTypes[fileType] || 0 },
        byDay: uploadMetrics.byDay,
      };
    }

    const response = {
      metrics: filteredMetrics,
      period: timeframe,
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
      filters: {
        fileType: fileType || 'all',
      },
      timestamp: new Date().toISOString(),
    };

    await this.redisService.set(cacheKey, JSON.stringify(response), 300);
    return response;
  }

  private async getSystemStatus(): Promise<any> {
    // Get current metrics
    const cpuUsage = parseFloat(
      ((1 - os.loadavg()[0] / os.cpus().length) * 100).toFixed(2),
    );
    const memoryUsage = parseFloat(
      (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
    );

    // Determine status based on thresholds
    let status = 'healthy';
    if (cpuUsage > 90 || memoryUsage > 90) {
      status = 'critical';
    } else if (cpuUsage > 70 || memoryUsage > 70) {
      status = 'warning';
    }

    return { status, cpuUsage, memoryUsage };
  }

  private async collectSystemMetrics(): Promise<void> {
    const cpuUsage = parseFloat(
      ((1 - os.loadavg()[0] / os.cpus().length) * 100).toFixed(2),
    );
    const memoryUsage = parseFloat(
      (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
    );

    // Save system metrics to database
    const metric = this.systemMetricRepository.create({
      timestamp: new Date(),
      cpuUsage: cpuUsage.toString(),
      memoryUsage: memoryUsage.toString(),
    });

    await this.systemMetricRepository.save(metric);

    // Check for alert conditions
    this.checkAlertConditions(cpuUsage, memoryUsage);
  }

  private async checkAlertConditions(
    cpuUsage: number,
    memoryUsage: number,
  ): Promise<void> {
    // Check CPU critical threshold
    if (cpuUsage > 90) {
      await this.createAlert(
        'high',
        'CPU usage critical',
        'system',
        `CPU usage at ${cpuUsage}%`,
      );
    } else if (cpuUsage > 75) {
      await this.createAlert(
        'medium',
        'CPU usage high',
        'system',
        `CPU usage at ${cpuUsage}%`,
      );
    }

    // Check memory critical threshold
    if (memoryUsage > 90) {
      await this.createAlert(
        'high',
        'Memory usage critical',
        'system',
        `Memory usage at ${memoryUsage}%`,
      );
    } else if (memoryUsage > 75) {
      await this.createAlert(
        'medium',
        'Memory usage high',
        'system',
        `Memory usage at ${memoryUsage}%`,
      );
    }
  }

  private async createAlert(
    severity: 'high' | 'medium' | 'low',
    title: string,
    type: string,
    message: string,
  ): Promise<void> {
    try {
      const existingAlert = await this.alertRepository.findOne({
        where: {
          title,
          component: type, // Use component since that's the field name
          status: 'active',
        },
      });

      if (existingAlert) {
        // Update existing alert
        existingAlert.count++;
        existingAlert.lastOccurrence = new Date();
        await this.alertRepository.save(existingAlert);
      } else {
        // Create new alert
        const alert = this.alertRepository.create({
          createdAt: new Date(),
          severity,
          title,
          component: type, // Match field name in entity
          type, // For backward compatibility
          message,
          status: 'active',
          count: 1,
          lastOccurrence: new Date(),
          timestamp: new Date(), // For backward compatibility
        });

        await this.alertRepository.save(alert);
      }
    } catch (error) {
      this.logger.error(`Failed to create alert: ${(error as Error).message}`);
    }
  }

  async createOrUpdateAlert(
    severity: AlertSeverity,
    type: string,
    title: string,
    message: string,
  ): Promise<Alert> {
    // Check if a similar alert already exists
    const existingAlert = await this.alertRepository.findOne({
      where: {
        type,
        status: 'active',
        // You might want to add additional criteria based on your requirements
      },
    });

    if (existingAlert) {
      // Update the existing alert
      existingAlert.count += 1;
      existingAlert.lastOccurrence = new Date();
      // Optionally update severity if new alert is more severe
      if (this.isSeverityHigher(severity, existingAlert.severity)) {
        existingAlert.severity = severity;
      }
      // Optionally update the message
      existingAlert.message = message;

      return this.alertRepository.save(existingAlert);
    }

    // Create a new alert if none exists
    const alert = this.alertRepository.create({
      timestamp: new Date(),
      severity,
      title,
      type,
      message,
      status: 'active',
      count: 1,
      lastOccurrence: new Date(),
    });

    return this.alertRepository.save(alert);
  }

  // Helper method to compare severity levels
  private isSeverityHigher(
    newSeverity: string,
    existingSeverity: string,
  ): boolean {
    const severityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      info: 0,
    };

    // Use type assertion to tell TypeScript these are valid keys
    return (
      (severityOrder[newSeverity] || 0) > (severityOrder[existingSeverity] || 0)
    );
  }

  private async getSystemMetricsData(
    startTime: Date,
    endTime: Date,
  ): Promise<any> {
    // Remove the 'category: api' filter since your entity doesn't have that field
    const metrics = await this.systemMetricRepository.find({
      where: {
        timestamp: Between(startTime, endTime),
        // Remove: category: 'api'
      },
      order: {
        timestamp: 'ASC',
      },
    });

    return this.processTimeSeriesData(metrics);
  }

  private async getErrorMetricsData(
    startTime: Date,
    endTime: Date,
  ): Promise<any> {
    const errors = await this.systemErrorRepository.find({
      where: {
        timestamp: Between(startTime, endTime),
      },
    });

    // Define an interface for the error data structure
    interface ErrorTypeData {
      count: number;
      errors: SystemError[];
    }

    // Group errors by type with proper typing
    const errorsByType = errors.reduce<Record<string, ErrorTypeData>>(
      (acc, error) => {
        if (!acc[error.type]) {
          acc[error.type] = {
            count: 0,
            errors: [],
          };
        }
        acc[error.type].count++;
        acc[error.type].errors.push(error);
        return acc;
      },
      {},
    );

    // Use the errorsByType to create the return value
    return {
      total: errors.length,
      byType: Object.entries(errorsByType).map(([type, data]) => ({
        type,
        count: data.count,
        percentage: (data.count / Math.max(1, errors.length)) * 100,
        recentErrors: data.errors
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
          .slice(0, 5),
      })),
      timeRange: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    };
  }

  private async getAlertsData(startTime: Date, endTime: Date): Promise<any> {
    const alerts = await this.alertRepository.find({
      where: {
        timestamp: Between(startTime, endTime),
      },
      order: {
        timestamp: 'DESC',
      },
    });

    const active = alerts.filter((a) => a.status === 'active').length;
    const resolved = alerts.filter((a) => a.status === 'resolved').length;

    return {
      total: alerts.length,
      active,
      resolved,
      recent: alerts.slice(0, 5),
    };
  }

  private async fetchUploadMetricsFromStorage(
    startTime: Date,
    endTime: Date,
  ): Promise<any> {
    const uploads = await this.fileUploadRepository.find({
      where: {
        createdAt: Between(startTime, endTime),
      },
    });

    const totalUploads = uploads.length;
    const totalSize = uploads.reduce((sum, upload) => sum + upload.size, 0);
    const averageSize = totalUploads > 0 ? totalSize / totalUploads : 0;

    // Define interface for fileTypes
    interface FileTypeCounts {
      [mimeType: string]: number;
    }

    // Group by file type with explicit typing
    const fileTypes = uploads.reduce<FileTypeCounts>((acc, upload) => {
      const mimeType = upload.mimeType || 'unknown';
      if (!acc[mimeType]) {
        acc[mimeType] = 0;
      }
      acc[mimeType]++;
      return acc;
    }, {});

    // Define interface for daily upload stats
    interface DailyUploadStats {
      count: number;
      size: number;
    }

    // Group by day with explicit typing
    const byDay = uploads.reduce<Record<string, DailyUploadStats>>(
      (acc, upload) => {
        const day = new Date(upload.createdAt).toISOString().split('T')[0];
        if (!acc[day]) {
          acc[day] = {
            count: 0,
            size: 0,
          };
        }
        acc[day].count++;
        acc[day].size += upload.size;
        return acc;
      },
      {},
    );

    return {
      totalUploads,
      totalSize,
      averageSize,
      fileTypes,
      byDay: Object.entries(byDay).map(([day, data]) => ({
        day,
        count: data.count,
        size: data.size,
      })),
    };
  }

  private getStartTimeFromTimeframe(timeframe: string): {
    startTime: Date;
    endTime: Date;
  } {
    const endTime = new Date();
    const startTime = new Date();

    switch (timeframe) {
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(endTime.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        break;
      default:
        startTime.setHours(endTime.getHours() - 1);
    }
    return { startTime, endTime };
  }

  private getTimeRangeFromQuery(query: MetricQueryDto): {
    startTime: Date;
    endTime: Date;
  } {
    const { timeframe, startTime, endTime } = query;

    // If custom start/end times are provided, use them
    if (startTime && endTime) {
      return { startTime, endTime };
    }

    // Otherwise use timeframe or default to 1 hour
    return this.getStartTimeFromTimeframe(timeframe || '1h');
  }

  private calculateAverage(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateErrorRate(metrics: any[]): number {
    const totalRequests = metrics.reduce((sum, m) => sum + Number(m.count), 0);

    // Determine errors based on status code (if available) or path containing "error"
    const errorRequests = metrics.reduce((sum, m) => {
      // If we have avgStatusCode, use that to determine errors (status >= 400)
      if (m.avgStatusCode && Number(m.avgStatusCode) >= 400) {
        return sum + Number(m.count);
      }
      // Otherwise fall back to checking if path contains "error"
      return sum + (m.path.includes('error') ? Number(m.count) : 0);
    }, 0);

    return totalRequests ? (errorRequests / totalRequests) * 100 : 0;
  }

  private processTimeSeriesData(metrics: SystemMetric[]): any[] {
    // Group metrics by hour
    const groupedData = metrics.reduce<
      Record<
        number,
        { timestamp: string; cpuValues: number[]; memoryValues: number[] }
      >
    >((acc, metric) => {
      const hour = new Date(metric.timestamp).setMinutes(0, 0, 0);
      if (!acc[hour]) {
        acc[hour] = {
          timestamp: new Date(hour).toISOString(),
          cpuValues: [],
          memoryValues: [],
        };
      }

      // Use parseFloat since your entity stores these as strings
      acc[hour].cpuValues.push(parseFloat(metric.cpuUsage));
      acc[hour].memoryValues.push(parseFloat(metric.memoryUsage));

      return acc;
    }, {});

    // Calculate averages for each time point
    return Object.values(groupedData).map((group) => ({
      timestamp: group.timestamp,
      cpu: this.calculateAverage(group.cpuValues),
      memory: this.calculateAverage(group.memoryValues),
    }));
  }

  private getPeriodMilliseconds(period: string): number {
    const unit = period.charAt(period.length - 1);
    const value = parseInt(period.slice(0, -1), 10);

    switch (unit) {
      case 'h': // hours
        return value * 60 * 60 * 1000;
      case 'd': // days
        return value * 24 * 60 * 60 * 1000;
      case 'w': // weeks
        return value * 7 * 24 * 60 * 60 * 1000;
      default:
        this.logger.warn(
          `Invalid period format: ${period}, using default of 24h`,
        );
        return 24 * 60 * 60 * 1000; // Default to 24 hours
    }
  }

  /**
   * @internal
   * Calculates the error rate from alerts based on their severity
   * This method is kept for potential future use
   */
  private calculateAlertErrorRate(alerts: Alert[]): number {
    const totalAlerts = alerts.length;
    const errorAlerts = alerts.filter(
      (alert) => alert.severity === 'high' || alert.severity === 'critical',
    ).length;
    return totalAlerts ? (errorAlerts / totalAlerts) * 100 : 0;
  }

  /**
   * Calculates the average CPU usage over a specific time period
   * @param timeframeMs Time period in milliseconds
   * @returns Average CPU usage as a percentage
   */
  private async calculateAverageCpuUsage(timeframeMs: number): Promise<number> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeframeMs);

      // If you have a metrics repository
      if (this.systemMetricRepository) {
        const metrics = await this.systemMetricRepository.find({
          where: {
            timestamp: Between(startTime, endTime),
            // Remove: metricType: 'api'
          },
        });

        if (metrics.length === 0) {
          return this.getCurrentCpuUsage();
        }

        // Calculate average using the actual property name in your entity
        const sum = metrics.reduce(
          (acc, metric) => acc + parseFloat(metric.cpuUsage),
          0,
        );
        return parseFloat((sum / metrics.length).toFixed(2));
      }

      // Fallback to current CPU usage if no repository or metrics
      return this.getCurrentCpuUsage();
    } catch (error: unknown) {
      this.logger.error(
        `Failed to calculate average CPU usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.getCurrentCpuUsage(); // Fallback to current usage
    }
  }

  /**
   * Calculates the average memory usage over a specific time period
   * @param timeframeMs Time period in milliseconds
   * @returns Average memory usage as a percentage
   */
  private async calculateAverageMemoryUsage(
    timeframeMs: number,
  ): Promise<number> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeframeMs);

      // If you have a metrics repository
      if (this.systemMetricRepository) {
        const metrics = await this.systemMetricRepository.find({
          where: {
            timestamp: Between(startTime, endTime),
            // Remove: metricType: 'api'
          },
        });

        if (metrics.length === 0) {
          return this.getCurrentMemoryUsage();
        }

        // Calculate average using the actual property name in your entity
        const sum = metrics.reduce(
          (acc, metric) => acc + parseFloat(metric.memoryUsage),
          0,
        );
        return parseFloat((sum / metrics.length).toFixed(2));
      }

      // Fallback to current memory usage
      return this.getCurrentMemoryUsage();
    } catch (error: unknown) {
      this.logger.error(
        `Failed to calculate average memory usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.getCurrentMemoryUsage(); // Fallback to current usage
    }
  }

  /**
   * Calculates the request rate over a specific time period
   * @param timeframeMs Time period in milliseconds
   * @returns Requests per second
   */
  private async calculateRequestRate(timeframeMs: number): Promise<number> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeframeMs);

      // If you have an API metrics repository
      if (this.apiMetricRepository) {
        const count = await this.apiMetricRepository.count({
          where: {
            timestamp: Between(startTime, endTime),
          },
        });

        // Calculate requests per second
        const seconds = timeframeMs / 1000;
        return parseFloat((count / seconds).toFixed(2));
      }

      return 0; // Default if no repository
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to calculate request rate: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Calculates the average response time over a specific time period
   * @param timeframeMs Time period in milliseconds
   * @returns Average response time in milliseconds
   */
  private async calculateAverageResponseTime(
    timeframeMs: number,
  ): Promise<number> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeframeMs);

      // If you have an API metrics repository
      if (this.apiMetricRepository) {
        const metrics = await this.apiMetricRepository.find({
          where: {
            timestamp: Between(startTime, endTime),
          },
          select: ['responseTime'],
        });

        if (metrics.length === 0) return 0;

        // Calculate average response time
        const sum = metrics.reduce(
          (acc, metric) => acc + metric.responseTime,
          0,
        );
        return parseFloat((sum / metrics.length).toFixed(2));
      }

      return 0; // Default if no repository
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to calculate average response time: ${errorMessage}`,
      );
      return 0;
    }
  }

  /**
   * Gets the current number of active connections
   */
  private async getActiveConnections(): Promise<number> {
    try {
      // Implementation depends on your server setup
      // For example, if using Express with a connection tracker:
      return this.connectionsManager
        ? this.connectionsManager.getActiveCount()
        : 0;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get active connections: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Gets the current number of queued jobs
   */
  private async getQueuedJobs(): Promise<number> {
    try {
      // Implementation depends on your job queue system
      // For Bull:
      if (this.jobQueue) {
        const jobCounts = await this.jobQueue.getJobCounts();
        return jobCounts.waiting + jobCounts.active;
      }
      return 0;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get queued jobs: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Gets the current CPU usage
   */
  private getCurrentCpuUsage(): number {
    try {
      const cpus = os.cpus();
      let idle = 0;
      let total = 0;

      for (const cpu of cpus) {
        idle += cpu.times.idle;
        total += Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      }

      // Calculate CPU usage percentage
      const usage = 100 - (idle / total) * 100;
      return parseFloat(usage.toFixed(2));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get current CPU usage: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Gets the current memory usage
   */
  private getCurrentMemoryUsage(): number {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const used = totalMem - freeMem;

      // Calculate memory usage percentage
      const usage = (used / totalMem) * 100;
      return parseFloat(usage.toFixed(2));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get current memory usage: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Checks system health and generates alerts based on metrics
   * @todo Implement scheduling for this method
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      // Get recent API metrics (last 15 minutes perhaps)
      const timeframeMs = 15 * 60 * 1000; // 15 minutes
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeframeMs);

      const apiMetrics = await this.apiMetricRepository.find({
        where: {
          timestamp: Between(startTime, endTime),
        },
      });

      // Calculate error rate
      const errorCount = apiMetrics.filter(
        (metric) => metric.statusCode >= 400,
      ).length;
      const errorRate =
        apiMetrics.length > 0 ? (errorCount / apiMetrics.length) * 100 : 0;

      // Generate alert if error rate is too high
      if (errorRate > 5) {
        // 5% error rate threshold
        await this.createAlert(
          'high', // or determine severity based on error rate
          'High API error rate',
          'api',
          `API error rate of ${errorRate.toFixed(2)}% detected in the last 15 minutes`,
        );

        // Log for monitoring purposes
        this.logger.warn(
          `High API error rate detected: ${errorRate.toFixed(2)}%`,
        );
      }

      // Also check alert metrics
      const alertTimeframeMs = 60 * 60 * 1000; // 1 hour
      const alertEndTime = new Date();
      const alertStartTime = new Date(
        alertEndTime.getTime() - alertTimeframeMs,
      );

      const recentAlerts = await this.alertRepository.find({
        where: {
          timestamp: Between(alertStartTime, alertEndTime),
        },
      });

      const alertErrorRate = this.calculateAlertErrorRate(recentAlerts);

      // If error rate from alerts is high, take action
      if (alertErrorRate > 25) {
        // 25% of alerts are high severity
        this.logger.warn(
          `High alert error rate detected: ${alertErrorRate.toFixed(2)}%`,
        );
        // Send notification or take other appropriate action
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error checking system health: ${errorMessage}`,
        errorStack,
      );
    }
  }

  @Cron('0 */15 * * * *') // Run every 15 minutes
  private async runSystemHealthCheck(): Promise<void> {
    try {
      await this.checkSystemHealth();
      this.logger.debug('System health check completed successfully');
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to check system health: ${error.message}`);
      } else {
        this.logger.error('Failed to check system health: Unknown error');
      }
    }
  }

  // Add a public method to manually trigger the health check
  public async triggerHealthCheck(): Promise<void> {
    return this.runSystemHealthCheck();
  }
}

// In your module file (e.g., monitoring.module.ts)
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    // Your other imports...
    BullModule.registerQueue({
      name: 'your-queue-name',
      // other queue options...
    }),
  ],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
