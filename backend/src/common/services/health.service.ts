import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis, Redis } from '@nestjs/redis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly s3: S3;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('file-processing') private readonly fileQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {
    this.s3 = new S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
  }

  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkS3(),
      this.checkQueues(),
      this.checkMemory(),
      this.checkDiskSpace(),
    ]);

    const details = {
      database: checks[0],
      redis: checks[1],
      storage: checks[2],
      queues: checks[3],
      memory: checks[4],
      disk: checks[5],
      timestamp: new Date().toISOString(),
    };

    // Determine overall status
    const status = this.determineOverallStatus(details);

    // Log health check results
    this.logger.log(`Health check completed: ${status}`, details);

    // Store health check results for trending
    await this.storeHealthCheck(status, details);

    return { status, details };
  }

  private async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.connection.query('SELECT 1');
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkRedis(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkS3(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.s3.listBuckets().promise();
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`S3 health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkQueues(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const [fileQueueMetrics, emailQueueMetrics] = await Promise.all([
      this.getQueueMetrics(this.fileQueue),
      this.getQueueMetrics(this.emailQueue),
    ]);

    const status = this.determineQueueHealth(
      fileQueueMetrics,
      emailQueueMetrics,
    );

    return {
      status,
      details: {
        fileProcessing: fileQueueMetrics,
        email: emailQueueMetrics,
      },
    };
  }

  private async getQueueMetrics(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    processedPerSecond: number;
  }> {
    const [waiting, active, completed, failed, delayed, metrics] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getMetrics(),
      ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      processedPerSecond: metrics?.processedPerSecond || 0,
    };
  }

  private async checkMemory(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      total: number;
      free: number;
      used: number;
      percentage: number;
    };
  }> {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    const percentage = (used.heapUsed / used.heapTotal) * 100;

    const status =
      percentage > 90 ? 'unhealthy' : percentage > 75 ? 'degraded' : 'healthy';

    return {
      status,
      details: {
        total,
        free,
        used: used.heapUsed,
        percentage,
      },
    };
  }

  private async checkDiskSpace(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      total: number;
      free: number;
      used: number;
      percentage: number;
    };
  }> {
    try {
      const { size, used } = await this.getDiskSpace();
      const percentage = (used / size) * 100;

      const status =
        percentage > 90
          ? 'unhealthy'
          : percentage > 75
            ? 'degraded'
            : 'healthy';

      return {
        status,
        details: {
          total: size,
          free: size - used,
          used,
          percentage,
        },
      };
    } catch (error) {
      this.logger.error(`Disk space check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        },
      };
    }
  }

  private determineQueueHealth(
    fileMetrics: any,
    emailMetrics: any,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const failureThreshold = 0.1; // 10% failure rate
    const delayThreshold = 100; // 100 delayed jobs

    const fileFailureRate =
      fileMetrics.failed / (fileMetrics.completed + fileMetrics.failed);
    const emailFailureRate =
      emailMetrics.failed / (emailMetrics.completed + emailMetrics.failed);

    if (
      fileFailureRate > failureThreshold ||
      emailFailureRate > failureThreshold ||
      fileMetrics.delayed > delayThreshold ||
      emailMetrics.delayed > delayThreshold
    ) {
      return 'unhealthy';
    }

    if (
      fileFailureRate > failureThreshold / 2 ||
      emailFailureRate > failureThreshold / 2 ||
      fileMetrics.delayed > delayThreshold / 2 ||
      emailMetrics.delayed > delayThreshold / 2
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  private determineOverallStatus(
    details: Record<string, any>,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(details)
      .filter((detail) => detail.status)
      .map((detail) => detail.status);

    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }

    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async storeHealthCheck(
    status: string,
    details: Record<string, any>,
  ): Promise<void> {
    await this.redis.zadd(
      'health:checks',
      Date.now(),
      JSON.stringify({
        status,
        details,
        timestamp: new Date().toISOString(),
      }),
    );

    // Keep only last 1000 health checks
    await this.redis.zremrangebyrank('health:checks', 0, -1001);
  }

  async getHealthHistory(limit = 100): Promise<
    Array<{
      status: string;
      details: Record<string, any>;
      timestamp: string;
    }>
  > {
    const checks = await this.redis.zrevrange(
      'health:checks',
      0,
      limit - 1,
      'WITHSCORES',
    );

    return checks.map((check) => JSON.parse(check));
  }
}
