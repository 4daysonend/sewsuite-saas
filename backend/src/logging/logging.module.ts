import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as Sentry from '@sentry/node';
import * as SentryTracing from '@sentry/tracing';
import { ErrorLog } from './entities/error-log.entity';
import { ErrorLogService } from './error-log.service';
import { LoggingService } from './logging.service';
import { SecurityLogService } from './security-log.service';
import { ActivityLogService } from './activity-log.service';
import { SecurityLog } from './entities/security-log.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { SentryInterceptor } from './interceptors/sentry.interceptor';
import { RequestLoggingInterceptor } from './interceptors/request-logging.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ErrorLog, SecurityLog, ActivityLog]),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const logLevel = configService.get('LOG_LEVEL') || 'info';
        const logDir = configService.get('LOG_DIR') || 'logs';

        // Configure Sentry
        const sentryDsn = configService.get('SENTRY_DSN');
        if (sentryDsn) {
          Sentry.init({
            dsn: sentryDsn,
            environment: configService.get('NODE_ENV'),
            integrations: [
              new Sentry.Integrations.Http({ tracing: true }),
              new SentryTracing.Integrations.Express(),
              new SentryTracing.Integrations.Postgres(),
            ],
            tracesSampleRate: isProduction ? 0.1 : 1.0,
          });
        }

        // Define log format
        const logFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          isProduction
            ? winston.format.json()
            : nestWinstonModuleUtilities.format.nestLike('SewSuite', {
                colors: true,
                prettyPrint: true,
              }),
        );

        // Create transports
        const transports: winston.transport[] = [
          // Always log to console
          new winston.transports.Console({
            format: logFormat,
          }),

          // Log errors to a separate file
          new DailyRotateFile({
            dirname: logDir,
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),

          // All logs
          new DailyRotateFile({
            dirname: logDir,
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ];

        // Conditional transports based on environment
        if (!isProduction) {
          transports.push(
            // Detailed debug logs in development
            new DailyRotateFile({
              dirname: logDir,
              filename: 'debug-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: '20m',
              maxFiles: '7d',
              level: 'debug',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
            }),
          );
        }

        return {
          level: logLevel,
          format: logFormat,
          transports,
          // Handle uncaught exceptions
          exceptionHandlers: [
            new DailyRotateFile({
              dirname: logDir,
              filename: 'exceptions-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: '20m',
              maxFiles: '30d',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
            }),
          ],
        };
      },
    }),
  ],
  providers: [
    ErrorLogService,
    LoggingService,
    SecurityLogService,
    ActivityLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
  exports: [
    ErrorLogService,
    LoggingService,
    SecurityLogService,
    ActivityLogService,
  ],
})
export class LoggingModule {}
