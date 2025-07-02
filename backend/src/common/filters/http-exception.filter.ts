import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express'; // Add explicit Request import
import { AppLoggerService } from '../services/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log the error
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : 'Unknown error',
      {
        statusCode: status,
        path: request.url,
        method: request.method,
        body: request.body,
        userId: request.user?.id,
      },
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : message,
    });
  }
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Define a proper type for errorResponse with index signature
    interface ErrorResponse {
      statusCode: number;
      timestamp: string;
      path: string;
      method: string;
      message: string;
      [key: string]: any; // Allow additional properties
    }

    // Format the error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'Internal server error',
    };

    // Add error details in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.error = (exceptionResponse as any).error || exception.name;
      if ((exceptionResponse as any).errors) {
        errorResponse.errors = (exceptionResponse as any).errors;
      }
    }

    // Log the error for internal tracking
    console.error(`[${status}] ${errorResponse.message}`, {
      path: request.url,
      method: request.method,
      ...(process.env.NODE_ENV !== 'production' ? { error: exception } : {}),
    });

    // Send the response
    response.status(status).json(errorResponse);
  }
}
