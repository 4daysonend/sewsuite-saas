import { Injectable, LoggerService } from '@nestjs/common';
// You might use Winston or another logger
import * as winston from 'winston';
// First install: npm install winston-sentry-log
import Sentry from 'winston-sentry-log';

@Injectable()
export class AppLoggerService implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760,
          maxFiles: 10,
          tailable: true,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760,
          maxFiles: 10,
          tailable: true,
        }),
        ...(isProd
          ? [
              new Sentry({
                config: {
                  dsn: process.env.SENTRY_DSN,
                },
                level: 'error',
              }),
            ]
          : []),
      ],
    });
  }

  log(message: string, context?: any) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: any) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: any) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: any) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: any) {
    this.logger.verbose(message, { context });
  }
}
