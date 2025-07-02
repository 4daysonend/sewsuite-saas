import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  private readonly sentryEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.sentryEnabled = !!this.configService.get('SENTRY_DSN');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // If Sentry is not enabled, just pass through
    if (!this.sentryEnabled) {
      return next.handle();
    }

    return next.handle().pipe(
      catchError((error) => {
        // Don't capture HTTP exceptions with status < 500
        if (error instanceof HttpException && error.getStatus() < 500) {
          throw error;
        }

        // Get request details
        const request = context.switchToHttp().getRequest();
        const { method, url, body, query, params, headers, user } = request;

        // Add additional context to the error
        Sentry.withScope((scope) => {
          // Set user context if available
          if (user) {
            scope.setUser({
              id: user.id,
              username: user.username || user.email,
              email: user.email,
            });
          }

          // Set request data
          scope.setExtra('method', method);
          scope.setExtra('url', url);
          scope.setExtra('body', this.sanitizeData(body));
          scope.setExtra('query', query);
          scope.setExtra('params', params);

          // Add IP and user agent
          scope.setExtra('ip', request.ip);
          scope.setExtra('userAgent', headers['user-agent']);

          // Capture the exception
          Sentry.captureException(error);
        });

        // Rethrow the error to be handled downstream
        throw error instanceof HttpException
          ? error
          : new InternalServerErrorException('Internal server error');
      }),
    );
  }

  private sanitizeData(data: any): any {
    if (!data) {
      return data;
    }

    // Create a deep clone to avoid modifying the original data
    const sanitized = JSON.parse(JSON.stringify(data));

    // Sensitive fields to sanitize
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

    // Function to recursively sanitize an object
    const sanitizeObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      Object.keys(obj).forEach((key) => {
        if (sensitiveFields.includes(key.toLowerCase())) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
    };

    sanitizeObject(sanitized);
    return sanitized;
  }
}
