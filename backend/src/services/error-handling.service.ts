import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

// Define proper interfaces for type safety
export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponseDto {
  message: string;
  details?: string | null;
  errorId: string | null;
  statusCode: number;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
      });
    }
  }

  // Method removed as it's not being used

  private handleFallback(exception: Error): void {
    try {
      console.error('[FALLBACK ERROR HANDLER]', exception);
      // Minimal fallback logging that won't throw
    } catch (fallbackError) {
      // Last resort logging - should never fail
      console.error('Critical error in error handler', {
        originalError: exception.message,
        fallbackError:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
      });
    }
  }

  async handleError(exception: Error, context?: ErrorContext): Promise<string> {
    try {
      // Generate a unique error ID for tracing
      const errorId = uuidv4();

      // Create a structured log entry
      const logEntry = {
        errorId,
        timestamp: new Date().toISOString(),
        type: exception.constructor.name,
        message: exception.message,
        stack: exception.stack,
        ...context,
      };

      // Log the error with context information
      this.logger.error(
        `Error [${errorId}]: ${exception.message}`,
        JSON.stringify(logEntry),
        context?.component || 'Unknown',
      );

      // Send to Sentry in production
      if (process.env.NODE_ENV === 'production') {
        Sentry.withScope((scope) => {
          scope.setTags({
            component: context?.component || 'unknown',
            operation: context?.operation || 'unknown',
          });

          if (context?.userId) {
            scope.setUser({ id: context.userId });
          }

          if (context?.metadata) {
            Object.entries(context.metadata).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }

          scope.setExtra('errorId', errorId);
          Sentry.captureException(exception);
        });
      }

      return errorId;
    } catch (handlerError) {
      // If the error handler itself fails, use fallback
      this.handleFallback(exception);
      this.handleFallback(
        handlerError instanceof Error
          ? handlerError
          : new Error(String(handlerError)),
      );
      return 'fallback-error';
    }
  }

  getErrorResponse(exception: Error, errorId?: string): ErrorResponseDto {
    // Determine appropriate error details based on the error type
    let message = 'Internal server error';
    let details: string | null = null;
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, any>;
        message = responseObj.message || exception.message;
        details = responseObj.details || null;
      } else if (typeof response === 'string') {
        message = response;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // For non-HTTP exceptions, mask details in production
      message = 'An unexpected error occurred';
      details =
        process.env.NODE_ENV === 'development' ? exception.message : null;
    }

    // Include the error ID if provided, otherwise null
    return {
      statusCode,
      message,
      details,
      errorId: errorId || null,
    };
  }
}
