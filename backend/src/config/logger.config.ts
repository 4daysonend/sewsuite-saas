import { LoggerService } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import Transport from 'winston-transport';
import * as path from 'path';
import * as fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import Sentry from 'winston-sentry-log';

export function setupLogger(): LoggerService {
  const logFilePath = process.env.LOG_FILE_PATH || 'logs/app.log';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const isProd = process.env.NODE_ENV === 'production';

  // Create log directory if it doesn't exist
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Use the generic Transport type from winston
  const transports: Transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.colorize(),
        winston.format.printf(
          (info) => `${info.timestamp} [${info.level}] ${info.message}`,
        ),
      ),
    }),
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      level: logLevel,
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ];

  // Add Sentry transport conditionally
  if (isProd && process.env.SENTRY_DSN) {
    transports.push(
      new Sentry({
        config: {
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          release: process.env.APP_VERSION || '1.0.0',
        },
        level: 'error',
      }),
    );
  }

  return WinstonModule.createLogger({
    transports,
  });
}
