import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip logging for health check endpoints to prevent noisy logs
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    if (
      request.url.includes('/health') ||
      request.url.includes('/metrics') ||
      request.url.includes('/favicon.ico')
    ) {
      return next.handle();
    }

    const { method, url, body, query, params, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const correlationId =
      headers['x-correlation-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set correlation ID for the current request if not present
    if (!headers['x-correlation-id']) {
      headers['x-correlation-id'] = correlationId;
    }

    const userId = request.user
      ? (request.user as any).id || 'anonymous'
      : 'anonymous';
    const requestTime = Date.now();

    // Log the incoming request
    this.logger.log(
      `[${correlationId}] ${method} ${url} - Started - User: ${userId} IP: ${ip}`,
    );

    // Debug level logging for request details
    this.logger.debug(`[${correlationId}] Request details`, {
      body: this.sanitizeData(body),
      query,
      params,
      userAgent,
    });

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const response = ctx.getResponse<Response>();
          const statusCode = response.statusCode;
          const contentLength =
            response.get('content-length') ||
            (data ? JSON.stringify(data).length : 0);
          const processingTime = Date.now() - requestTime;

          // Log successful response
          this.logger.log(
            `[${correlationId}] ${method} ${url} - ${statusCode} - ${processingTime}ms - ${contentLength}b - User: ${userId}`,
          );

          // Debug level logging for response details (limited to avoid huge logs)
          if (data && typeof data === 'object') {
            this.logger.debug(
              `[${correlationId}] Response data keys: ${Object.keys(data).join(', ')}`,
            );
          }
        },
        error: (error: Error) => {
          // Log error brief (the full error is handled by the exception filter)
          const processingTime = Date.now() - requestTime;

          this.logger.warn(
            `[${correlationId}] ${method} ${url} - Failed after ${processingTime}ms - ${error.message}`,
          );
        },
      }),
    );
  }

  /**
   * Sanitize sensitive data before logging
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'authorization',
      'api_key',
      'apiKey',
      'key',
      'credential',
      'credit_card',
      'creditCard',
      'cardNumber',
    ];

    try {
      const sanitized = { ...data };

      // Recursively sanitize objects
      const sanitizeObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        Object.keys(obj).forEach((key) => {
          if (
            sensitiveFields.some((field) =>
              key.toLowerCase().includes(field.toLowerCase()),
            )
          ) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            sanitizeObject(obj[key]);
          }
        });
      };

      sanitizeObject(sanitized);
      return sanitized;
    } catch (err) {
      return { sanitizedError: 'Could not sanitize request data' };
    }
  }
}
