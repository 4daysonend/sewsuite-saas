import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get('NODE_ENV', 'development');
  }

  async handleError(
    error: Error,
    context: {
      component: string;
      operation: string;
      userId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<string> {
    const errorId = this.generateErrorId(error, context);

    // Log error details
    this.logger.error({
      errorId,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date(),
      environment: this.environment,
    });

    // Store error for analysis
    await this.storeError(errorId, error, context);

    // Trigger alerts if needed
    await this.checkAlertThresholds(context.component, error);

    return errorId;
  }

  private generateErrorId(error: Error, context: any): string {
    const data = `${error.message}:${context.component}:${context.operation}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  private async storeError(
    errorId: string,
    error: Error,
    context: any,
  ): Promise<void> {
    try {
      // Store in database or error tracking service
      // This could be integrated with services like Sentry
      this.logger.debug(`Stored error: ${errorId}`);
    } catch (storageError) {
      this.logger.error(`Failed to store error: ${storageError.message}`);
    }
  }

  private async checkAlertThresholds(
    component: string,
    error: Error,
  ): Promise<void> {
    try {
      // Implement alert logic based on error patterns
      // This could integrate with monitoring services
      this.logger.debug(`Checked alert thresholds for ${component}`);
    } catch (alertError) {
      this.logger.error(`Failed to check alerts: ${alertError.message}`);
    }
  }

  getErrorResponse(
    error: Error,
    errorId: string,
  ): {
    message: string;
    errorId: string;
    userMessage?: string;
  } {
    // In production, don't expose internal error details
    if (this.environment === 'production') {
      return {
        message: 'An unexpected error occurred',
        errorId,
        userMessage: this.getUserFriendlyMessage(error),
      };
    }

    return {
      message: error.message,
      errorId,
      stack: error.stack,
    };
  }

  private getUserFriendlyMessage(error: Error): string {
    // Map technical errors to user-friendly messages
    const errorMessages = {
      QuotaExceededError:
        'Your storage quota has been exceeded. Please free up some space.',
      InvalidChunkError:
        'There was a problem with the file upload. Please try again.',
      ProcessingError:
        'We could not process your file. Please ensure it meets our requirements.',
      StorageError:
        'There was a problem storing your file. Please try again later.',
      ValidationError:
        'The provided information is invalid. Please check your input.',
    };

    return (
      errorMessages[error.constructor.name] ||
      'An unexpected error occurred. Please try again later.'
    );
  }
}
