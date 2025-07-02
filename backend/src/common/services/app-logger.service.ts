// In a new file: src/common/services/app-logger.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppLoggerService {
  private readonly logger = new Logger(AppLoggerService.name);

  constructor(private readonly configService: ConfigService) {}

  // Add this method to match NestJS's built-in Logger API
  log(message: string, context?: string | object): void {
    if (typeof context === 'string') {
      this.logger.log(message, context);
    } else if (context) {
      this.logger.log(`${message} ${JSON.stringify(context)}`);
    } else {
      this.logger.log(message);
    }

    // If you have additional logging requirements, add them here
    this.logInfo('app_log', {
      message,
      context: context || {},
      level: 'info',
    });
  }

  // Add this method to your AppLoggerService
  logError(event: string, metadata: Record<string, any>): void {
    const environment =
      this.configService.get<string>('NODE_ENV') || 'development';
    const timestamp = new Date().toISOString();

    // Structured logging format
    const logData = {
      timestamp,
      level: 'error',
      event,
      environment,
      ...metadata,
    };

    // In production, you might want to send this to a structured logging service
    if (environment === 'production') {
      // Here you could integrate with services like DataDog, NewRelic, etc.
      // For now, we'll just log to console in a structured format
      console.error(JSON.stringify(logData));
    } else {
      // For development/staging, log in a more readable format
      this.logger.error(`[${event}] ${JSON.stringify(metadata)}`);
    }
  }

  // You might also want to add these complementary methods:
  logInfo(event: string, metadata: Record<string, any>): void {
    const environment =
      this.configService.get<string>('NODE_ENV') || 'development';
    const timestamp = new Date().toISOString();

    const logData = {
      timestamp,
      level: 'info',
      event,
      environment,
      ...metadata,
    };

    if (environment === 'production') {
      console.log(JSON.stringify(logData));
    } else {
      this.logger.log(`[${event}] ${JSON.stringify(metadata)}`);
    }
  }

  logWarning(event: string, metadata: Record<string, any>): void {
    const environment =
      this.configService.get<string>('NODE_ENV') || 'development';
    const timestamp = new Date().toISOString();

    const logData = {
      timestamp,
      level: 'warn',
      event,
      environment,
      ...metadata,
    };

    if (environment === 'production') {
      console.warn(JSON.stringify(logData));
    } else {
      this.logger.warn(`[${event}] ${JSON.stringify(metadata)}`);
    }
  }

  logDebug(event: string, metadata: Record<string, any>): void {
    const environment =
      this.configService.get<string>('NODE_ENV') || 'development';

    // Only log debug in non-production environments by default
    if (
      environment !== 'production' ||
      this.configService.get<boolean>('DEBUG_LOGS')
    ) {
      const timestamp = new Date().toISOString();

      const logData = {
        timestamp,
        level: 'debug',
        event,
        environment,
        ...metadata,
      };

      if (environment === 'production') {
        console.debug(JSON.stringify(logData));
      } else {
        this.logger.debug(`[${event}] ${JSON.stringify(metadata)}`);
      }
    }
  }

  // Simple logging methods for direct console output
  simpleLog(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  simpleError(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  simpleWarn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  simpleDebug(message: string): void {
    console.debug(`[DEBUG] ${message}`);
  }

  // In your AppLoggerService implementation
  error(message: string, ...optionalParams: any[]): void {
    this.log(`[ERROR] ${message}`, ...optionalParams);
  }
}
