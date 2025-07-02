import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as Sentry from '@sentry/node';
import { ErrorLogService } from './error-log.service';
import { SecurityLogService } from './security-log.service';
import { ActivityLogService } from './activity-log.service';

export enum LogSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

interface LogContext {
  [key: string]: any;
}

interface ErrorLogOptions {
  source: string;
  message: string;
  stack?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface SecurityLogOptions {
  action: string;
  userId?: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  status?: 'success' | 'failure';
}

interface ActivityLogOptions {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
}

interface HttpLogOptions {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  requestBody?: any;
  requestQuery?: any;
  responseSize?: number;
}

interface ApiLogOptions {
  service: string;
  method: string;
  endpoint: string;
  requestData?: any;
  responseData?: any;
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
}

@Injectable()
export class LoggingService {
  private sentryEnabled: boolean;
  private readonly environment: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: LoggerService,
    private readonly errorLogService: ErrorLogService,
    private readonly securityLogService: SecurityLogService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {
    this.sentryEnabled = !!this.configService.get('SENTRY_DSN');
    this.environment = this.configService.get('NODE_ENV') || 'development';
  }

  /**
   * Log a message with specified severity
   */
  log(
    message: string,
    context?: LogContext,
    severity: LogSeverity = LogSeverity.INFO,
  ): void {
    this.logger.log(severity, message, context);
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: LogContext): void {
    if (this.logger && typeof this.logger.debug === 'function') {
      this.logger.debug(message, context);
    } else {
      // Fallback to console if logger is unavailable
      console.debug(message, context);
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    this.logger.log(LogSeverity.INFO, message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  /**
   * Log error messages
   */
  error(message: string, trace?: string, context?: LogContext): void {
    this.logger.error(message, trace, context);
  }

  /**
   * Capture and log error with persistence and Sentry integration
   */
  async captureError(
    error: Error | string,
    options: ErrorLogOptions,
  ): Promise<void> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    // Log to Winston
    this.error(
      `[${options.source || 'unknown'}] ${errorMessage}`,
      errorStack,
      options.metadata,
    );

    // Save to database
    await this.errorLogService.create({
      source: options.source || 'unknown',
      message: errorMessage,
      stack: errorStack || options.stack,
      userId: options.userId,
      metadata: options.metadata,
    });

    // Send to Sentry if enabled
    if (this.sentryEnabled) {
      Sentry.withScope((scope) => {
        scope.setTag('source', options.source || 'unknown');

        if (options.userId) {
          scope.setUser({ id: options.userId });
        }

        if (options.metadata) {
          Object.entries(options.metadata).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        if (typeof error === 'string') {
          Sentry.captureMessage(error, {
            level: 'error' as Sentry.SeverityLevel,
          });
        } else {
          Sentry.captureException(error);
        }
      });
    }
  }

  /**
   * Log security-related events (authentication, authorization, etc.)
   */
  async logSecurityEvent(options: SecurityLogOptions): Promise<void> {
    // Log to Winston
    this.logger.log(
      LogSeverity.INFO,
      `[Security] ${options.action} ${options.status || 'performed'} by user ${options.userId || 'anonymous'}`,
      {
        securityEvent: true,
        ...options,
      },
    );

    // Save to database
    await this.securityLogService.create({
      action: options.action,
      userId: options.userId,
      targetId: options.targetId,
      targetType: options.targetType,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: options.metadata,
      status: options.status,
    });
  }

  /**
   * Log user activity
   */
  async logActivity(options: ActivityLogOptions): Promise<void> {
    // Log to Winston
    this.logger.log(
      LogSeverity.INFO,
      `[Activity] User ${options.userId} performed ${options.action} on ${options.resourceType}${options.resourceId ? ' ' + options.resourceId : ''}`,
      {
        activityEvent: true,
        ...options,
      },
    );

    // Save to database
    await this.activityLogService.create({
      userId: options.userId,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      details: options.details,
    });
  }

  /**
   * Log HTTP requests
   */
  logHttpRequest(options: HttpLogOptions): void {
    const responseLevel =
      options.statusCode >= 500
        ? LogSeverity.ERROR
        : options.statusCode >= 400
          ? LogSeverity.WARN
          : LogSeverity.INFO;

    this.logger.log(
      responseLevel,
      `[HTTP] ${options.method} ${options.url} ${options.statusCode} ${options.responseTime}ms`,
      {
        httpRequest: true,
        ...options,
      },
    );
  }

  /**
   * Log external API interactions
   */
  logApiCall(options: ApiLogOptions): void {
    const success = options.statusCode && options.statusCode < 400;
    const level = success ? LogSeverity.INFO : LogSeverity.ERROR;

    this.logger.log(
      level,
      `[API] ${options.service} ${options.method} ${options.endpoint} ${options.statusCode || 'N/A'} ${options.responseTime || 0}ms`,
      {
        apiCall: true,
        ...options,
      },
    );
  }

  /**
   * Log background job execution
   */
  logJobExecution(
    jobName: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    metadata?: Record<string, any>,
  ): void {
    const level = status === 'failed' ? LogSeverity.ERROR : LogSeverity.INFO;

    if (this.logger && typeof this.logger.log === 'function') {
      this.logger.log(
        level,
        `[JOB] ${jobName} ${status}${duration ? ' in ' + duration + 'ms' : ''}`,
        {
          jobExecution: true,
          jobName,
          status,
          duration,
          // Ensure environment is defined
          environment: this.environment || 'unknown',
          ...(metadata || {}),
        },
      );
    } else {
      // Fallback to console if logger is unavailable
      console[level === LogSeverity.ERROR ? 'error' : 'log'](
        `[JOB] ${jobName} ${status}${duration ? ' in ' + duration + 'ms' : ''}`,
        {
          jobExecution: true,
          jobName,
          status,
          duration,
          environment: this.environment || 'unknown',
          ...(metadata || {}),
        },
      );
    }
  }
}
