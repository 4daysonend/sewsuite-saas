import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorHandlingService } from '../services/error-handling.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorHandlingService: ErrorHandlingService) {}

  async catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const errorId = await this.errorHandlingService.handleError(exception, {
      component: 'HTTP',
      operation: `${request.method} ${request.url}`,
      userId: request.user?.id,
      metadata: {
        headers: request.headers,
        query: request.query,
        params: request.params,
      },
    });

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = this.errorHandlingService.getErrorResponse(
      exception,
      errorId,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...errorResponse,
    });
  }
}
