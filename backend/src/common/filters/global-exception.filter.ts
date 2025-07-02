import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost): void {
    // Get HTTP adapter from context
    const { httpAdapter } = this.httpAdapterHost;

    // Get the current execution context
    const ctx = host.switchToHttp();

    // Get the request object
    const request = ctx.getRequest<Request>();

    // Determine if exception is HTTP-based or something else
    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract error message
    let errorMessage: string;
    let errorDetails: any = {};

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      errorMessage = exception.message;

      if (typeof response === 'object') {
        errorDetails = response;
      }
    } else {
      errorMessage = exception?.message || 'Internal server error';

      if (exception?.stack) {
        errorDetails.stack = exception.stack;
      }
    }

    // Include some context with the error
    const errorContext = {
      timestamp: new Date().toISOString(),
      path: request?.url,
      method: request?.method,
      correlationId: request?.headers['x-correlation-id'] || 'not-available',
      userId: request?.user
        ? (request.user as any).id || 'anonymous'
        : 'anonymous',
    };

    // Prepare response body
    const responseBody = {
      statusCode: httpStatus,
      message: errorMessage,
      path: request?.url,
      timestamp: errorContext.timestamp,
    };

    // Log the error with appropriate level based on status code
    if (httpStatus >= 500) {
      this.logger.error(
        `[${errorContext.correlationId}] ${errorMessage}`,
        exception?.stack,
        errorContext,
      );

      // Send 5xx errors to Sentry if available
      try {
        Sentry.withScope((scope) => {
          scope.setExtras(errorContext);
          Sentry.captureException(exception);
        });
      } catch (sentryError) {
        this.logger.warn('Failed to send error to Sentry', sentryError);
      }
    } else if (httpStatus >= 400) {
      this.logger.warn(
        `[${errorContext.correlationId}] ${errorMessage}`,
        errorContext,
      );
    }

    // For async contexts (like queue processors)
    const contextType = host.getType();
    if (contextType !== 'http') {
      this.logger.error(
        `Error in ${contextType} context: ${errorMessage}`,
        exception?.stack,
        { type: contextType, ...errorContext },
      );
      return;
    }

    // Send response
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
