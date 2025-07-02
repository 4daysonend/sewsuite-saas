import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggingService } from '../logging.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip logging for health check and metrics endpoints to avoid noise
    const request = context.switchToHttp().getRequest();
    if (
      request.url.includes('/health') ||
      request.url.includes('/metrics') ||
      request.url.includes('/favicon.ico')
    ) {
      return next.handle();
    }

    // Removed 'params' from the destructuring
    const { method, url, ip, headers, body, query, user } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestStartTime = Date.now();

    // Log request start
    this.logger.log(`Incoming request: ${method} ${url} from ${ip}`);

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          // Calculate response time
          const responseTime = Date.now() - requestStartTime;

          // Get the response status code from the context
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;

          // Log the request details using our centralized logging service
          this.loggingService.logHttpRequest({
            method,
            url,
            statusCode,
            responseTime,
            ipAddress: ip,
            userAgent,
            userId: user?.id,
            // Don't log full request body and response for privacy and security
            requestBody: this.sanitizeRequestBody(body),
            requestQuery: query,
            responseSize: this.estimateResponseSize(responseBody),
          });
        },
        error: (error) => {
          // Calculate response time
          const responseTime = Date.now() - requestStartTime;

          // Extract status code from error
          const statusCode = error.status || error.statusCode || 500;

          // Log the request with error details
          this.loggingService.logHttpRequest({
            method,
            url,
            statusCode,
            responseTime,
            ipAddress: ip,
            userAgent,
            userId: user?.id,
            requestBody: this.sanitizeRequestBody(body),
            requestQuery: query,
          });
        },
      }),
    );
  }

  /**
   * Sanitize request body to avoid logging sensitive information
   */
  private sanitizeRequestBody(body: any): any {
    if (!body) return {};

    try {
      const sanitized = { ...body };

      // Sensitive fields to remove or mask
      const sensitiveFields = [
        'password',
        'confirmPassword',
        'currentPassword',
        'newPassword',
        'token',
        'accessToken',
        'refreshToken',
        'credit_card',
        'creditCard',
        'ssn',
        'secret',
        'apiKey',
      ];

      // Mask sensitive fields
      Object.keys(sanitized).forEach((key) => {
        if (sensitiveFields.includes(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        }
      });

      // For large request bodies, just return a summary
      if (JSON.stringify(sanitized).length > 1000) {
        return {
          _summary: `Large request body (${Object.keys(sanitized).length} fields)`,
          _fields: Object.keys(sanitized),
        };
      }

      return sanitized;
    } catch (error) {
      return { _error: 'Could not sanitize request body' };
    }
  }

  /**
   * Estimate response size in bytes
   */
  private estimateResponseSize(response: any): number {
    if (!response) return 0;

    try {
      return Buffer.byteLength(JSON.stringify(response));
    } catch (error) {
      return 0;
    }
  }
}
