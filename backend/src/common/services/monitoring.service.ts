import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Controller,
  Get,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SystemMetric,
  ErrorLog,
  UploadMetric,
  ApiMetric,
  SystemAlert,
} from '../entities';
import * as client from 'prom-client';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);

  private readonly apiResponseTime = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  private readonly jobFailureCounter = new client.Counter({
    name: 'job_failures_total',
    help: 'Number of job failures',
    labelNames: ['job_type'],
  });

  private readonly paymentTransactions = new client.Counter({
    name: 'payment_transactions_total',
    help: 'Payment transactions processed',
    labelNames: ['status', 'provider'],
  });

  constructor(
    @InjectRepository(SystemMetric)
    private readonly systemMetricsRepository: Repository<SystemMetric>,
    @InjectRepository(ErrorLog)
    private readonly errorLogsRepository: Repository<ErrorLog>,
    @InjectRepository(UploadMetric)
    private readonly uploadMetricsRepository: Repository<UploadMetric>,
    @InjectRepository(ApiMetric)
    private readonly apiMetricsRepository: Repository<ApiMetric>,
    @InjectRepository(SystemAlert)
    private readonly systemAlertsRepository: Repository<SystemAlert>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    // Register metrics with the default registry
    client.register.registerMetric(this.apiResponseTime);
    client.register.registerMetric(this.jobFailureCounter);
    client.register.registerMetric(this.paymentTransactions);

    // Set up default metrics
    client.collectDefaultMetrics();

    this.logger.log('Prometheus metrics initialized');
  }

  private handleError(error: unknown, message: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`${message}: ${errorMessage}`, errorStack);
    throw new InternalServerErrorException(message, {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }

  recordApiCall(
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
  ): void {
    try {
      // Convert ms to seconds for prometheus
      const responseTimeSec = responseTimeMs / 1000;
      this.apiResponseTime
        .labels({ method, path, status_code: statusCode.toString() })
        .observe(responseTimeSec);

      this.logger.debug(
        `Recorded API call: ${method} ${path} ${statusCode} ${responseTimeSec}s`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record API metrics: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  recordJobFailure(jobType: string): void {
    try {
      this.jobFailureCounter.labels({ job_type: jobType }).inc();
      this.logger.debug(`Recorded job failure for ${jobType}`);
    } catch (error) {
      this.logger.error(
        `Failed to record job failure: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  recordPaymentTransaction(status: string, provider: string): void {
    try {
      this.paymentTransactions.labels({ status, provider }).inc();
      this.logger.debug(
        `Recorded payment transaction: ${provider} - ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record payment transaction: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async getMetricsSummary() {
    try {
      // Get the latest system metrics
      const latestMetrics = await this.systemMetricsRepository
        .createQueryBuilder('metrics')
        .orderBy('metrics.timestamp', 'DESC')
        .limit(1)
        .getOne();

      if (!latestMetrics) {
        this.logger.warn('No system metrics data available');
        throw new InternalServerErrorException(
          'System metrics data not available',
        );
      }

      // Get average metrics for the last hour for comparison
      const lastHourAvg = await this.systemMetricsRepository
        .createQueryBuilder('metrics')
        .select('AVG(metrics.cpuUsage)', 'avgCpuUsage')
        .addSelect('AVG(metrics.memoryUsage)', 'avgMemoryUsage')
        .addSelect('AVG(metrics.diskUsage)', 'avgDiskUsage')
        .addSelect('AVG(metrics.networkBytesIn)', 'avgNetBytesIn')
        .addSelect('AVG(metrics.networkBytesOut)', 'avgNetBytesOut')
        .addSelect('AVG(metrics.networkConnections)', 'avgConnections')
        .where('metrics.timestamp >= :timeAgo', {
          timeAgo: new Date(Date.now() - 3600000), // 1 hour ago
        })
        .getRawOne();

      // Get load average metrics (last 3 records for 1, 5, 15 minute averages)
      const loadAverageData = await this.systemMetricsRepository
        .createQueryBuilder('metrics')
        .select('metrics.loadAverage', 'loadAverage')
        .orderBy('metrics.timestamp', 'DESC')
        .limit(3)
        .getRawMany();

      const loadAverage =
        loadAverageData.length > 0
          ? loadAverageData.map((record) => record.loadAverage[0])
          : [0, 0, 0];

      // Calculate trends by comparing current values with hour averages
      const calculateTrend = (current: number, average: number): number => {
        // If average is zero or very close to it, return a special value or zero
        if (Math.abs(average) < 0.0001) return 0;

        // Calculate percentage change
        const percentChange = ((current - average) / average) * 100;

        // Return the percentage change rounded to 1 decimal place
        return Math.round(percentChange * 10) / 10;
      };

      const cpuTrend = calculateTrend(
        latestMetrics.cpuUsage,
        parseFloat(lastHourAvg?.avgCpuUsage || '0'),
      );

      const memoryTrend = calculateTrend(
        latestMetrics.memoryUsage,
        parseFloat(lastHourAvg?.avgMemoryUsage || '0'),
      );

      const diskTrend = calculateTrend(
        latestMetrics.diskUsage,
        parseFloat(lastHourAvg?.avgDiskUsage || '0'),
      );

      const networkInTrend = calculateTrend(
        latestMetrics.networkBytesIn,
        parseFloat(lastHourAvg?.avgNetBytesIn || '0'),
      );

      const networkOutTrend = calculateTrend(
        latestMetrics.networkBytesOut,
        parseFloat(lastHourAvg?.avgNetBytesOut || '0'),
      );

      const connectionsTrend = calculateTrend(
        latestMetrics.networkConnections,
        parseFloat(lastHourAvg?.avgConnections || '0'),
      );

      return {
        cpu: {
          usage: parseFloat(latestMetrics.cpuUsage.toFixed(1)),
          cores: latestMetrics.cpuCores,
          loadAverage: loadAverage,
          trend: parseFloat(cpuTrend.toFixed(1)), // Percent change from hour average
        },
        memory: {
          total: latestMetrics.memoryTotal,
          used: latestMetrics.memoryUsed,
          free: latestMetrics.memoryFree,
          usage: parseFloat(latestMetrics.memoryUsage.toFixed(1)),
          trend: parseFloat(memoryTrend.toFixed(1)),
        },
        disk: {
          total: latestMetrics.diskTotal,
          used: latestMetrics.diskUsed,
          free: latestMetrics.diskFree,
          usage: parseFloat(latestMetrics.diskUsage.toFixed(1)),
          trend: parseFloat(diskTrend.toFixed(1)),
        },
        network: {
          bytesIn: latestMetrics.networkBytesIn,
          bytesOut: latestMetrics.networkBytesOut,
          connections: latestMetrics.networkConnections,
          inTrend: parseFloat(networkInTrend.toFixed(1)),
          outTrend: parseFloat(networkOutTrend.toFixed(1)),
          connectionsTrend: parseFloat(connectionsTrend.toFixed(1)),
        },
        uptime: latestMetrics.uptime,
        timestamp: latestMetrics.timestamp,
      };
    } catch (error: unknown) {
      return this.handleError(error, 'Failed to retrieve metrics summary');
    }
  }

  async getErrorMetrics(
    component?: string,
    timeRange?: { startTime?: Date; endTime?: Date },
  ): Promise<any> {
    try {
      this.logger.log(
        `Fetching error metrics for ${component ? `component: ${component}` : 'all components'}${
          timeRange
            ? ` from ${timeRange.startTime?.toISOString() || 'any'} to ${timeRange.endTime?.toISOString() || 'any'}`
            : ''
        }`,
      );

      // Build the base query
      const queryBuilder = this.errorLogsRepository.createQueryBuilder('error');

      // Store conditions and parameters separately
      const conditions: string[] = [];
      const parameters: Record<string, any> = {};

      // Apply filters based on provided parameters
      if (component) {
        conditions.push('error.component = :component');
        parameters.component = component;
      }

      if (timeRange?.startTime) {
        conditions.push('error.timestamp >= :startTime');
        parameters.startTime = timeRange.startTime;
      }

      if (timeRange?.endTime) {
        conditions.push('error.timestamp <= :endTime');
        parameters.endTime = timeRange.endTime;
      }

      // Apply conditions to query builder
      if (conditions.length > 0) {
        queryBuilder.where(conditions.join(' AND '), parameters);
      }

      // Get total errors count
      const totalErrors = await queryBuilder.getCount();

      // Get component distribution
      const componentDistributionQuery = this.errorLogsRepository
        .createQueryBuilder('error')
        .select('error.component', 'component')
        .addSelect('COUNT(error.id)', 'count');

      // Apply the same conditions to this query
      if (conditions.length > 0) {
        componentDistributionQuery.where(conditions.join(' AND '), parameters);
      }

      const componentDistribution = await componentDistributionQuery
        .groupBy('error.component')
        .getRawMany();

      // Format component distribution as object
      const byComponent = componentDistribution.reduce((acc, item) => {
        acc[item.component] = parseInt(item.count, 10);
        return acc;
      }, {});

      // Get time distribution (grouped by hour for the filtered period)
      const timeDistributionQuery = this.errorLogsRepository
        .createQueryBuilder('error')
        .select("DATE_TRUNC('hour', error.timestamp)", 'hour')
        .addSelect('COUNT(error.id)', 'count');

      // Apply the same conditions to this query
      if (conditions.length > 0) {
        timeDistributionQuery.where(conditions.join(' AND '), parameters);
      }

      const timeDistributionData = await timeDistributionQuery
        .groupBy('hour')
        .orderBy('hour', 'ASC')
        .getRawMany();

      // Format time distribution
      const timeDistribution = timeDistributionData.map((item) => ({
        timestamp: new Date(item.hour).toISOString(),
        count: parseInt(item.count, 10),
      }));

      // Get most common errors
      const mostCommonErrorsQuery = this.errorLogsRepository
        .createQueryBuilder('error')
        .select('error.message', 'message')
        .addSelect('COUNT(error.id)', 'count');

      // Apply the same conditions to this query
      if (conditions.length > 0) {
        mostCommonErrorsQuery.where(conditions.join(' AND '), parameters);
      }

      const mostCommonErrorsData = await mostCommonErrorsQuery
        .groupBy('error.message')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      // Format most common errors
      const mostCommonErrors = mostCommonErrorsData.map((item) => ({
        message: item.message,
        count: parseInt(item.count, 10),
      }));

      return {
        totalErrors,
        byComponent,
        timeDistribution,
        mostCommonErrors,
      };
    } catch (error: unknown) {
      return this.handleError(error, 'Failed to retrieve error metrics');
    }
  }

  async getUploadMetrics(options: {
    period: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<any> {
    try {
      this.logger.log(
        `Fetching upload metrics for period: ${options.period}${
          options.startTime ? `, start: ${options.startTime.toISOString()}` : ''
        }${options.endTime ? `, end: ${options.endTime.toISOString()}` : ''}`,
      );

      // Build base query
      const queryBuilder =
        this.uploadMetricsRepository.createQueryBuilder('upload');

      // Apply time range filters if provided
      if (options.startTime) {
        queryBuilder.andWhere('upload.timestamp >= :startTime', {
          startTime: options.startTime,
        });
      }

      if (options.endTime) {
        queryBuilder.andWhere('upload.timestamp <= :endTime', {
          endTime: options.endTime,
        });
      }

      // Apply different time period filters based on the period option
      switch (options.period) {
        case 'day':
          queryBuilder.andWhere("upload.timestamp >= NOW() - INTERVAL '1 day'");
          break;
        case 'week':
          queryBuilder.andWhere(
            "upload.timestamp >= NOW() - INTERVAL '7 days'",
          );
          break;
        case 'month':
          queryBuilder.andWhere(
            "upload.timestamp >= NOW() - INTERVAL '30 days'",
          );
          break;
        case 'year':
          queryBuilder.andWhere(
            "upload.timestamp >= NOW() - INTERVAL '365 days'",
          );
          break;
        // Default case is not to add any additional time filter
      }

      // Get total uploads count
      const totalUploads = await queryBuilder.getCount();

      // Get total size (sum of all file sizes in bytes, converted to GB)
      const totalSizeResult = await queryBuilder
        .select('SUM(upload.fileSize)', 'totalSize')
        .getRawOne();

      // Calculate total size in GB (bytes to GB conversion)
      const totalSizeBytes = parseInt(totalSizeResult?.totalSize || '0', 10);
      const totalSizeGB = totalSizeBytes / (1024 * 1024 * 1024);

      // Calculate average file size
      const avgFileSizeResult = await queryBuilder
        .select('AVG(upload.fileSize)', 'avgSize')
        .getRawOne();

      // Average file size in MB (bytes to MB conversion)
      const avgFileSizeBytes = parseFloat(avgFileSizeResult?.avgSize || '0');
      const avgFileSizeMB = avgFileSizeBytes / (1024 * 1024);

      // Get uploads by file type
      const uploadsByTypeResult = await queryBuilder
        .select('upload.fileType', 'fileType')
        .addSelect('COUNT(upload.id)', 'count')
        .groupBy('upload.fileType')
        .getRawMany();

      // Format uploads by type as object
      const uploadsByType = uploadsByTypeResult.reduce((acc, item) => {
        const fileType = item.fileType.toLowerCase();
        // Group into common categories
        if (fileType.includes('image')) {
          acc.image = (acc.image || 0) + parseInt(item.count, 10);
        } else if (
          fileType.includes('document') ||
          fileType.includes('pdf') ||
          fileType.includes('doc') ||
          fileType.includes('xls') ||
          fileType.includes('txt')
        ) {
          acc.document = (acc.document || 0) + parseInt(item.count, 10);
        } else if (fileType.includes('video')) {
          acc.video = (acc.video || 0) + parseInt(item.count, 10);
        } else {
          acc.other = (acc.other || 0) + parseInt(item.count, 10);
        }
        return acc;
      }, {});

      // Get time distribution
      const timeDistributionQuery = queryBuilder
        .select("DATE_TRUNC('hour', upload.timestamp)", 'hour')
        .addSelect('COUNT(upload.id)', 'count')
        .groupBy('hour')
        .orderBy('hour', 'ASC');

      const timeDistributionResult = await timeDistributionQuery.getRawMany();

      // Format time distribution
      const timeDistribution = timeDistributionResult.map((item) => ({
        timestamp: new Date(item.hour).toISOString(),
        count: parseInt(item.count, 10),
      }));

      // Return the metrics
      return {
        totalUploads,
        totalSize: parseFloat(totalSizeGB.toFixed(2)),
        averageFileSize: parseFloat(avgFileSizeMB.toFixed(2)),
        uploadsByType,
        timeDistribution,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving upload metrics: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve upload metrics',
        {
          cause: error,
        },
      );
    }
  }

  async getAPIMetrics(
    path?: string,
    method?: string,
    timeframe?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Fetching API metrics ${path ? `for path: ${path}` : 'for all paths'}${
          method ? `, method: ${method}` : ''
        }${timeframe ? `, timeframe: ${timeframe}` : ''}`,
      );

      // Build base query
      const queryBuilder = this.apiMetricsRepository.createQueryBuilder('api');

      // Store conditions in an array to reuse them
      const conditions: string[] = [];
      const parameters: Record<string, any> = {};

      // Apply filters based on provided parameters
      if (path) {
        conditions.push('api.path LIKE :path');
        parameters.path = `%${path}%`;
      }

      if (method) {
        conditions.push('api.method = :method');
        parameters.method = method;
      }

      // Apply timeframe filter
      if (timeframe) {
        switch (timeframe) {
          case 'today':
            conditions.push('api.timestamp >= CURRENT_DATE');
            break;
          case 'yesterday':
            conditions.push("api.timestamp >= CURRENT_DATE - INTERVAL '1 day'");
            conditions.push('api.timestamp < CURRENT_DATE');
            break;
          case 'week':
            conditions.push(
              "api.timestamp >= CURRENT_DATE - INTERVAL '7 days'",
            );
            break;
          case 'month':
            conditions.push(
              "api.timestamp >= CURRENT_DATE - INTERVAL '30 days'",
            );
            break;
          case 'year':
            conditions.push(
              "api.timestamp >= CURRENT_DATE - INTERVAL '365 days'",
            );
            break;
        }
      }

      // Apply conditions to query builder
      if (conditions.length > 0) {
        queryBuilder.where(conditions.join(' AND '), parameters);
      }

      // Get total requests count
      const totalRequests = await queryBuilder.getCount();

      // Get average response time
      const avgTimeResult = await queryBuilder
        .select('AVG(api.responseTime)', 'avgTime')
        .getRawOne();
      const averageResponseTime = Math.round(
        parseFloat(avgTimeResult?.avgTime || '0'),
      );

      // For the raw SQL queries, construct the WHERE clause manually
      let whereClause = '1=1'; // Default condition that's always true
      const sqlParams: any[] = [];

      if (conditions.length > 0) {
        // Replace named parameters with positional parameters for raw SQL
        let paramIndex = 1;
        whereClause = conditions
          .map((condition) => {
            // Replace :param with $1, $2, etc.
            return condition.replace(/:([\w]+)/g, (_match, paramName) => {
              if (parameters[paramName] === undefined) {
                this.logger.warn(
                  `Parameter ${paramName} not provided for SQL query`,
                );
                sqlParams.push(null); // Push null as fallback
              } else {
                sqlParams.push(parameters[paramName]);
              }
              return `$${paramIndex++}`;
            });
          })
          .join(' AND ');
      }

      // Get 95th percentile response time using window functions
      const p95Result = await this.apiMetricsRepository.query(
        `
        SELECT response_time as "responseTime"
        FROM (
          SELECT 
            response_time,
            NTILE(100) OVER (ORDER BY response_time) as percentile
          FROM api_metrics
          WHERE ${whereClause}
        ) as percentiles
        WHERE percentile = 95
        LIMIT 1
      `,
        sqlParams,
      );
      const p95ResponseTime =
        p95Result.length > 0 ? parseInt(p95Result[0].responseTime, 10) : 0;

      // Get 99th percentile response time using window functions
      const p99Result = await this.apiMetricsRepository.query(
        `
        SELECT response_time as "responseTime"
        FROM (
          SELECT 
            response_time,
            NTILE(100) OVER (ORDER BY response_time) as percentile
          FROM api_metrics
          WHERE ${whereClause}
        ) as percentiles
        WHERE percentile = 99
        LIMIT 1
      `,
        sqlParams,
      );
      const p99ResponseTime =
        p99Result.length > 0 ? parseInt(p99Result[0].responseTime, 10) : 0;

      // Get metrics by endpoint
      const endpointMetrics = await this.apiMetricsRepository
        .createQueryBuilder('api')
        .select('api.path', 'path')
        .addSelect('api.method', 'method')
        .addSelect('COUNT(api.id)', 'count')
        .addSelect('AVG(api.responseTime)', 'avgTime')
        .where(
          queryBuilder.expressionMap.wheres
            ? queryBuilder.getQuery().split('WHERE')[1]
            : '1=1',
        )
        .setParameters(parameters)
        .groupBy('api.path')
        .addGroupBy('api.method')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      // Format endpoint metrics
      const byEndpoint = endpointMetrics.map((item) => ({
        path: item.path,
        method: item.method,
        count: parseInt(item.count, 10),
        avgTime: Math.round(parseFloat(item.avgTime)),
      }));

      // Get response code distribution
      const responseCodeMetrics = await this.apiMetricsRepository
        .createQueryBuilder('api')
        .select('api.statusCode', 'statusCode')
        .addSelect('COUNT(api.id)', 'count')
        .where(conditions.length > 0 ? conditions.join(' AND ') : '1=1')
        .setParameters(parameters)
        .groupBy('api.statusCode')
        .orderBy('statusCode', 'ASC')
        .getRawMany();

      // Format response code distribution
      const responseCodeDistribution = responseCodeMetrics.reduce(
        (acc, item) => {
          acc[item.statusCode] = parseInt(item.count, 10);
          return acc;
        },
        {},
      );

      return {
        totalRequests,
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        byEndpoint,
        responseCodeDistribution,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving API metrics: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException('Failed to retrieve API metrics', {
        cause: error,
      });
    }
  }

  async getAlerts(options: {
    status?: 'active' | 'resolved';
    severity?: 'high' | 'medium' | 'low';
    limit?: number;
  }) {
    try {
      this.logger.log(
        `Fetching alerts with filters: status=${options.status || 'any'}, severity=${
          options.severity || 'any'
        }, limit=${options.limit || 'default'}`,
      );

      // Build base query
      const queryBuilder =
        this.systemAlertsRepository.createQueryBuilder('alert');

      // Apply filters based on options
      if (options.status) {
        queryBuilder.andWhere('alert.status = :status', {
          status: options.status,
        });
      }

      if (options.severity) {
        queryBuilder.andWhere('alert.severity = :severity', {
          severity: options.severity,
        });
      }

      // Count active alerts regardless of other filters
      const activeAlertsCount = await this.systemAlertsRepository
        .createQueryBuilder('alert')
        .where('alert.status = :status', { status: 'active' })
        .getCount();

      // Apply limit if provided, otherwise use default limit of 10
      const effectiveLimit = options.limit || 10;
      queryBuilder.limit(effectiveLimit);

      // Order by timestamp descending (most recent first)
      queryBuilder.orderBy('alert.timestamp', 'DESC');

      // Execute query to get alerts
      const alerts = await queryBuilder.getMany();

      return {
        totalActive: activeAlertsCount,
        alerts: alerts.map((alert) => ({
          id: alert.id,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          status: alert.status,
          component: alert.component,
          timestamp: alert.timestamp.toISOString(),
          resolvedBy: alert.resolvedBy,
          resolutionMessage: alert.resolutionMessage,
          resolutionTimestamp: alert.resolutionTimestamp?.toISOString(),
        })),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving system alerts: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve system alerts',
        {
          cause: error,
        },
      );
    }
  }

  async getHealthStatus() {
    try {
      this.logger.log('Checking system health status');

      // Define services to check
      const services = [
        'api',
        'database',
        'storage',
        'cache',
        'email',
        'payment',
      ];

      // Get the latest health check records for each service
      const healthChecks = await Promise.all(
        services.map(async (service) => {
          try {
            // For each service, query its latest health check record
            // This assumes you have a health_checks table with service, status, latency columns
            const result = await this.dataSource.query(
              `
              SELECT status, latency, checked_at
              FROM health_checks
              WHERE service = $1
              ORDER BY checked_at DESC
              LIMIT 1
            `,
              [service],
            );

            if (result && result.length > 0) {
              return {
                service,
                status: result[0].status,
                latency: parseInt(result[0].latency, 10),
              };
            }

            // If no health check found, return unknown status
            return {
              service,
              status: 'unknown',
              latency: null,
            };
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Error checking health for ${service}: ${errorMessage}`,
            );
            return {
              service,
              status: 'error',
              latency: null,
              error: errorMessage,
            };
          }
        }),
      );

      // Calculate overall status
      // If any critical service is down, the overall status is down
      // If any service is degraded, the overall status is degraded
      const criticalServices = ['api', 'database'];
      let overallStatus = 'healthy';

      const formattedServices = healthChecks.reduce<
        Record<string, { status: string; latency: number }>
      >((acc, check) => {
        acc[check.service] = {
          status: check.status,
          latency: check.latency ?? 0, // Use nullish coalescing to provide a default value of 0
        };

        // Update overall status based on service health
        if (
          check.status === 'down' &&
          criticalServices.includes(check.service)
        ) {
          overallStatus = 'down';
        } else if (check.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }

        return acc;
      }, {});

      return {
        status: overallStatus,
        services: formattedServices,
        lastChecked: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving system health status: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve system health status',
        { cause: error },
      );
    }
  }

  async getPerformanceMetrics(timeframe: string) {
    try {
      this.logger.log(
        `Fetching performance metrics for timeframe: ${timeframe}`,
      );

      // Determine time range based on timeframe parameter
      let interval = '5 minutes';
      const timeAgo = new Date();

      switch (timeframe) {
        case 'hour':
          timeAgo.setHours(timeAgo.getHours() - 1);
          interval = '1 minute';
          break;
        case 'day':
          timeAgo.setDate(timeAgo.getDate() - 1);
          interval = '30 minutes';
          break;
        case 'week':
          timeAgo.setDate(timeAgo.getDate() - 7);
          interval = '2 hours';
          break;
        case 'month':
          timeAgo.setMonth(timeAgo.getMonth() - 1);
          interval = '8 hours';
          break;
        default:
          // Default to last hour
          timeAgo.setHours(timeAgo.getHours() - 1);
          interval = '1 minute';
      }

      // Build query for CPU metrics
      const cpuQuery = this.systemMetricsRepository
        .createQueryBuilder('metrics')
        .select('DATE_TRUNC($1, metrics.timestamp)', 'timestamp')
        .addSelect('AVG(metrics.cpuUsage)', 'value')
        .where('metrics.timestamp >= :timeAgo', { timeAgo })
        .groupBy('timestamp')
        .orderBy('timestamp', 'ASC')
        .setParameter('1', interval);

      // Build query for memory metrics
      const memoryQuery = this.systemMetricsRepository
        .createQueryBuilder('metrics')
        .select('DATE_TRUNC($1, metrics.timestamp)', 'timestamp')
        .addSelect('AVG(metrics.memoryUsed)', 'value')
        .where('metrics.timestamp >= :timeAgo', { timeAgo })
        .groupBy('timestamp')
        .orderBy('timestamp', 'ASC')
        .setParameter('1', interval);

      // Build query for connection metrics
      const connectionsQuery = this.systemMetricsRepository
        .createQueryBuilder('metrics')
        .select('DATE_TRUNC($1, metrics.timestamp)', 'timestamp')
        .addSelect('AVG(metrics.networkConnections)', 'value')
        .where('metrics.timestamp >= :timeAgo', { timeAgo })
        .groupBy('timestamp')
        .orderBy('timestamp', 'ASC')
        .setParameter('1', interval);

      // Build query for API response time metrics
      const responseTimeQuery = this.apiMetricsRepository
        .createQueryBuilder('api')
        .select('DATE_TRUNC($1, api.timestamp)', 'timestamp')
        .addSelect('AVG(api.responseTime)', 'value')
        .where('api.timestamp >= :timeAgo', { timeAgo })
        .groupBy('timestamp')
        .orderBy('timestamp', 'ASC')
        .setParameter('1', interval);

      // Execute all queries in parallel
      const [
        cpuResults,
        memoryResults,
        connectionsResults,
        responseTimeResults,
      ] = await Promise.all([
        cpuQuery.getRawMany(),
        memoryQuery.getRawMany(),
        connectionsQuery.getRawMany(),
        responseTimeQuery.getRawMany(),
      ]);

      // Format CPU metrics
      const cpu = cpuResults.map((item) => ({
        timestamp: new Date(item.timestamp).toISOString(),
        value: parseFloat(parseFloat(item.value).toFixed(1)),
      }));

      // Format Memory metrics
      const memory = memoryResults.map((item) => ({
        timestamp: new Date(item.timestamp).toISOString(),
        value: Math.round(parseFloat(item.value)),
      }));

      // Format Connection metrics
      const activeConnections = connectionsResults.map((item) => ({
        timestamp: new Date(item.timestamp).toISOString(),
        value: Math.round(parseFloat(item.value)),
      }));

      // Format Response Time metrics
      const responseTime = responseTimeResults.map((item) => ({
        timestamp: new Date(item.timestamp).toISOString(),
        value: Math.round(parseFloat(item.value)),
      }));

      return {
        cpu,
        memory,
        activeConnections,
        responseTime,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving performance metrics: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve performance metrics',
        { cause: error },
      );
    }
  }

  getMetrics(): Promise<string> {
    return client.register.metrics();
  }
}

@Controller('metrics')
export class MetricsController {
  @Get()
  getMetrics() {
    return client.register.metrics();
  }
}
