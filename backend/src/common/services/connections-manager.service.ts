import {
  Injectable,
  Logger,
  // Remove these unused imports:
  // NestMiddleware,
  // MiddlewareConsumer,
  // Module,
  // NestModule,
  OnModuleInit,
  OnModuleDestroy,
  NestMiddleware,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { Request, Response } from 'express'; // Check if these are also unused
import { randomUUID } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

// Add this interface definition at the top of your file (outside the class)
export interface ConnectionMetrics {
  timestamp: string;
  totalConnections: number;
  serviceCount: number;
  averageConnectionsPerService: number;
  serviceBreakdown: Record<string, number>;
  healthStatus: 'healthy' | 'at-capacity' | 'degraded';
}

/**
 * Enhanced ConnectionsManager for production environments
 * Provides reliable connection tracking with self-healing capabilities
 */
@Injectable()
export class ConnectionsManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionsManager.name);
  private cleanupInterval: NodeJS.Timeout; // Store the interval ID

  // Configuration with defaults (override via environment variables)
  private readonly connectionTimeout: number;
  private readonly cleanupIntervalDuration: number;
  private readonly connectionLimit: number;
  private readonly serviceId: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService?: ConfigService,
  ) {
    // Add this line to make direct usage of configService clear to TypeScript
    const hasConfig = !!this.configService;

    // Your existing initialization
    this.connectionTimeout =
      this.getConfig('CONNECTION_TIMEOUT_SECONDS', 30) * 1000;
    this.cleanupIntervalDuration =
      this.getConfig('CONNECTION_CLEANUP_INTERVAL_SECONDS', 60) * 1000;
    this.connectionLimit = this.getConfig('MAX_CONNECTIONS_PER_SERVICE', 10000);
    this.serviceId = this.getConfig(
      'SERVICE_ID',
      `service-${randomUUID().slice(0, 8)}`,
    );

    this.logger.log(
      `ConnectionsManager initialized for service: ${this.serviceId} ${hasConfig ? 'with' : 'without'} config service`,
    );
  }

  /**
   * Helper method to get config values with defaults
   */
  private getConfig<T>(key: string, defaultValue: T): T {
    if (!this.configService) return defaultValue;
    return this.configService.get<T>(key) ?? defaultValue;
  }

  /**
   * Helper method to safely extract error messages
   * @param error Unknown error object
   * @param defaultMessage Optional default message if error isn't an Error object
   * @returns Formatted error message
   */
  private getErrorMessage(
    error: unknown,
    defaultMessage = 'Unknown error',
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return defaultMessage;
  }

  /**
   * Register this service instance in the service registry
   */
  async onModuleInit() {
    try {
      // Register this service instance
      await this.redisService.sadd('connection:services', this.serviceId);
      await this.redisService.set(
        `connection:service:${this.serviceId}:heartbeat`,
        Date.now().toString(),
        300, // 5 minutes TTL for service registration
      );
      this.logger.log(
        `Service ${this.serviceId} registered for connection tracking`,
      );

      // Start the cleanup interval using the cleanupIntervalDuration
      this.cleanupInterval = setInterval(() => {
        this.cleanupStaleConnections();
      }, this.cleanupIntervalDuration);

      this.logger.log(
        `Connection manager initialized with cleanup every ${this.cleanupIntervalDuration / 1000} seconds`,
      );
    } catch (error: unknown) {
      this.logger.error(`Error message: ${this.getErrorMessage(error)}`);
      // Additional error handling...
    }
  }

  /**
   * Cleanup when service shuts down
   */
  async onModuleDestroy() {
    try {
      // Clear the interval when the module is destroyed
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.logger.log('Connection manager cleanup interval stopped');
      }

      // De-register this service
      await this.redisService.srem('connection:services', this.serviceId);
      this.logger.log(
        `Service ${this.serviceId} de-registered from connection tracking`,
      );
    } catch (error: unknown) {
      this.logger.error(`Error message: ${this.getErrorMessage(error)}`);
      // Additional error handling...
    }
  }

  /**
   * Increment connection count for a service
   * @param serviceId The service identifier
   * @returns Current connection count
   */
  async incrementConnections(serviceId: string = 'default'): Promise<number> {
    try {
      // Create a unique connection ID
      const connectionId = randomUUID();
      const timestamp = Date.now();

      // Check connection limits
      const currentCount = await this.getActiveCount(serviceId);
      if (currentCount >= this.connectionLimit) {
        this.logger.warn(
          `Connection limit reached for service ${serviceId}: ${currentCount}`,
        );
        return currentCount; // Skip incrementing
      }

      // Execute both operations
      await Promise.all([
        // Increment connection counter
        this.redisService.increment(`connections:${serviceId}`),

        // Store connection details with TTL
        this.redisService.set(
          `connection:${connectionId}`,
          JSON.stringify({ serviceId, timestamp }),
          this.connectionTimeout / 1000,
        ),
      ]);

      // Get the accurate count after increment
      const count = await this.getActiveCount(serviceId);

      this.logger.debug(
        `Connection added to ${serviceId}, current count: ${count}`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Failed to increment connections: ${this.getErrorMessage(error)}`,
      );

      // Fallback: best effort to return accurate count
      try {
        return await this.getActiveCount(serviceId);
      } catch {
        // No error variable captured since we don't use it
        return 0; // Last resort fallback
      }
    }
  }

  /**
   * Decrement connection count for a service
   * @param serviceId The service identifier
   * @returns Current connection count
   */
  async decrementConnections(serviceId: string = 'default'): Promise<number> {
    try {
      // Get current count to prevent going below zero
      const currentCount = await this.getActiveCount(serviceId);

      if (currentCount > 0) {
        await this.redisService.decrement(`connections:${serviceId}`);
      } else {
        // Reset to zero if somehow went negative
        await this.redisService.set(`connections:${serviceId}`, '0');
      }

      const newCount = await this.getActiveCount(serviceId);
      this.logger.debug(`Connection removed from ${serviceId}`);
      return newCount;
    } catch (error) {
      this.logger.error(
        `Failed to decrement connections: ${this.getErrorMessage(error)}`,
      );

      try {
        return Math.max(0, (await this.getActiveCount(serviceId)) - 1);
      } catch {
        return 0; // Last resort fallback
      }
    }
  }

  /**
   * Get active connections count for a service
   * @param serviceId The service identifier
   * @returns Current connection count
   */
  async getActiveCount(serviceId: string = 'default'): Promise<number> {
    return this.withCircuitBreaker(
      async () => {
        const count = await this.redisService.get(`connections:${serviceId}`);
        return count ? parseInt(count, 10) : 0;
      },
      0, // Fallback value
      `getActiveCount(${serviceId})`,
    );
  }

  /**
   * Get connection counts for all services
   * @returns Record of service IDs to connection counts
   */
  async getServiceConnections(): Promise<Record<string, number>> {
    try {
      const keys = await this.redisService.getKeysByPattern('connections:*');
      const result: Record<string, number> = {};

      for (const key of keys) {
        const serviceId = key.split(':')[1];
        const count = await this.redisService.get(key);
        result[serviceId] = count ? parseInt(count, 10) : 0;
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get service connections: ${this.getErrorMessage(error)}`,
      );
      return {}; // Safe default
    }
  }

  /**
   * Get total connections across all services
   * @returns Total connection count
   */
  async getTotalConnections(): Promise<number> {
    try {
      const services = await this.getServiceConnections();
      return Object.values(services).reduce((sum, count) => sum + count, 0);
    } catch (error) {
      this.logger.error(
        `Failed to get total connections: ${this.getErrorMessage(error)}`,
      );
      return 0;
    }
  }

  /**
   * Scheduled job to clean up stale connections
   * Runs on the schedule defined by CRON_CLEANUP_SCHEDULE or every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleConnections() {
    try {
      this.logger.debug('Running connection cleanup job');

      // Clean up any orphaned service entries (services that have gone down)
      const services = await this.redisService.smembers('connection:services');

      for (const serviceId of services) {
        const heartbeat = await this.redisService.get(
          `connection:service:${serviceId}:heartbeat`,
        );

        if (!heartbeat) {
          // Service hasn't updated heartbeat, likely down
          this.logger.warn(
            `Service ${serviceId} appears to be down, resetting connection count`,
          );
          await this.redisService.set(`connections:${serviceId}`, '0');
          await this.redisService.srem('connection:services', serviceId);
        }
      }

      // Update this service's heartbeat
      await this.redisService.set(
        `connection:service:${this.serviceId}:heartbeat`,
        Date.now().toString(),
        300, // 5 minutes TTL
      );

      this.logger.debug('Connection cleanup completed');
    } catch (error) {
      this.logger.error(
        `Connection cleanup failed: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get metrics about the connection system
   * Cloud-agnostic metrics that could be sent to any monitoring system
   */
  async getConnectionMetrics(): Promise<ConnectionMetrics> {
    const services = await this.getServiceConnections();
    const total = Object.values(services).reduce(
      (sum, count) => sum + count,
      0,
    );
    const serviceCount = Object.keys(services).length;

    return {
      timestamp: new Date().toISOString(),
      totalConnections: total,
      serviceCount,
      averageConnectionsPerService: serviceCount > 0 ? total / serviceCount : 0,
      serviceBreakdown: services,
      healthStatus: this.determineHealthStatus({
        total,
        serviceCount,
        limit: this.connectionLimit,
      }),
    };
  }

  private determineHealthStatus(metrics: {
    total: number;
    serviceCount: number;
    limit: number;
  }): ConnectionMetrics['healthStatus'] {
    const { total, serviceCount, limit } = metrics;

    // No services registered
    if (serviceCount === 0) {
      return 'degraded';
    }

    // Check absolute numbers
    if (total >= limit) {
      return 'at-capacity';
    }

    // Check percentage utilization
    const capacityPercentage = (total / limit) * 100;

    if (capacityPercentage > 80) {
      return 'degraded'; // High load but not yet at capacity
    }

    return 'healthy';
  }

  private async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: string,
  ): Promise<T> {
    try {
      // Track operation timing for performance metrics
      const startTime = performance.now();
      const result = await operation();
      const duration = performance.now() - startTime;

      // Log slow operations
      if (duration > 100) {
        this.logger.warn(
          `Slow Redis operation (${duration.toFixed(2)}ms) in ${context}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Redis operation failed in ${context}: ${this.getErrorMessage(error)}`,
      );
      return fallback;
    }
  }

  async getMultipleServiceCounts(
    serviceIds: string[],
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    // Batch all Redis get operations into a single pipeline
    const pipeline = this.redisService.pipeline();

    for (const serviceId of serviceIds) {
      pipeline.get(`connections:${serviceId}`);
    }

    try {
      const responses = await pipeline.exec();

      if (responses) {
        serviceIds.forEach((serviceId, index) => {
          // Use underscore to indicate we're intentionally not using this variable
          const [, value] = responses[index] || [null, null];
          result[serviceId] =
            typeof value === 'string' ? parseInt(value, 10) : 0;
        });
      } else {
        // Handle the case where responses is null
        this.logger.warn('Pipeline execution returned null responses');
        serviceIds.forEach((serviceId) => {
          console.log(serviceId);
          result[serviceId] = 0;
        });
      }

      return result;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to batch get service counts: ${this.getErrorMessage(error)}`,
      );

      // Ensure this loop is properly formed
      for (const serviceId of serviceIds) {
        result[serviceId] = await this.getActiveCount(serviceId);
      }

      return result; // Make sure to return after the fallback
    }
  }
}

/**
 * Enhanced middleware that tracks connections with diagnostic information
 */
@Injectable()
export class ConnectionTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ConnectionTrackingMiddleware.name);

  // Add properties to store config values
  private readonly rateLimitRequests: number;
  private readonly rateLimitWindowMs: number;
  private readonly serviceName: string;

  constructor(
    private readonly connectionsManager: ConnectionsManager,
    private readonly configService?: ConfigService,
  ) {
    // Use the configService to initialize properties
    this.rateLimitRequests = this.getConfig('RATE_LIMIT_REQUESTS', 100);
    this.rateLimitWindowMs = this.getConfig('RATE_LIMIT_WINDOW_MS', 60000);
    this.serviceName = this.getConfig('SERVICE_NAME', 'api');

    this.logger.log(
      `Middleware initialized with rate limit: ${this.rateLimitRequests} requests per ${this.rateLimitWindowMs / 1000}s`,
    );
  }

  // Helper method similar to what you have in ConnectionsManager
  private getConfig<T>(key: string, defaultValue: T): T {
    return this.configService
      ? this.configService.get<T>(key) ?? defaultValue
      : defaultValue;
  }

  private getHeaderValue(headers: any, key: string): string | undefined {
    const value = headers[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  }

  // Then use these configuration values in your use method:
  use(req: Request, res: Response, next: () => void): void {
    const startTime = Date.now();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const path = req.path;
    const method = req.method;
    const requestId =
      this.getHeaderValue(req.headers, 'x-request-id') || randomUUID();

    // Add request ID to response headers for tracking
    res.setHeader('x-request-id', requestId);

    // Determine service from path or header
    const service =
      this.getHeaderValue(req.headers, 'x-service') ||
      path.split('/')[1] ||
      this.serviceName;

    // Log request start
    this.logger.debug(
      `${method} ${path} from ${clientIp} [${requestId}] - started`,
    );

    // Track connection with service identifier
    this.connectionsManager
      .incrementConnections(service)
      .catch((err) =>
        this.logger.error(`Failed to increment connections: ${err.message}`),
      );

    // Track completion and timing
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log request completion with timing
      this.logger.debug(
        `${method} ${path} from ${clientIp} [${requestId}] - ${statusCode} (${duration}ms)`,
      );

      // Decrement the connection counter
      this.connectionsManager
        .decrementConnections(service)
        .catch((err) =>
          this.logger.error(`Failed to decrement connections: ${err.message}`),
        );
    });

    // Continue request processing
    next();
  }
}

/**
 * Module that provides connection tracking functionality
 */
@Module({
  imports: [],
  providers: [ConnectionsManager],
  exports: [ConnectionsManager],
})
export class ConnectionsModule {}
