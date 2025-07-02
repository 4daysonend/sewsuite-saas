import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ErrorEntity } from '../entities/error.entity'; // Update the import path

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);
  private readonly environment: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ErrorEntity)
    private readonly errorRepository: Repository<ErrorEntity>,
  ) {
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
      const errorDetails = {
        errorId,
        message: error.message,
        stack: error.stack,
        name: error.name,
        context, // Include context in the error details
      };

      // Example: Log the error details
      this.logger.debug(`Stored error: ${JSON.stringify(errorDetails)}`);

      // Store the error details in the database
      await this.errorRepository.save(errorDetails);
    } catch (storageError) {
      if (storageError instanceof Error) {
        this.logger.error(`Failed to store error: ${storageError.message}`);
      } else {
        this.logger.error('Failed to store error: Unknown error');
      }
    }
  }

  private async checkAlertThresholds(
    component: string,
    error: Error,
  ): Promise<void> {
    try {
      // Implement alert logic based on error patterns
      // Example: Check if the error message matches certain patterns
      if (error.message.includes('specific pattern')) {
        // Trigger an alert
        this.logger.warn(`Alert triggered for ${component}: ${error.message}`);
        // Integrate with monitoring services
        // await this.monitoringService.triggerAlert(component, error);
      }

      this.logger.debug(`Checked alert thresholds for ${component}`);
    } catch (alertError) {
      if (alertError instanceof Error) {
        this.logger.error(`Failed to check alerts: ${alertError.message}`);
      } else {
        this.logger.error('Failed to check alerts: Unknown error');
      }
    }
  }
}
