// /backend/src/email/email.module.ts
import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailController } from './email.controller';
import { EmailConsumer } from './email.consumer';
import { registerTemplateHelpers } from './helpers/template-helpers';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { User } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';

const QUEUE_NAME = 'email' as const;

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    AuditModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL', 60),
            limit: config.get('THROTTLE_LIMIT', 10),
          },
        ],
        skipIf: () => false,
      }),
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'email-dlq' }, // Add dead-letter queue
    ),
    BullModule.registerQueueAsync({
      name: QUEUE_NAME,
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService,
      ): Promise<BullModuleOptions> => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT');
        const password = configService.get<string>('REDIS_PASSWORD');
        const db = configService.get<number>('REDIS_DB');

        return {
          name: QUEUE_NAME,
          redis: {
            host: host || 'localhost',
            port: port || 6379,
            password,
            db: db || 0,
            // ...rest of your redis config
          },
          // ...rest of your config
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'email',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Extract config values with proper typing
        const redisHost = configService.get<string>('QUEUE_REDIS_HOST');
        const redisPort = configService.get<number>('QUEUE_REDIS_PORT');
        const redisPassword = configService.get<string>('QUEUE_REDIS_PASSWORD');
        const redisDb = configService.get<number>('QUEUE_REDIS_DB');

        return {
          name: 'email',
          redis: {
            host: redisHost || 'localhost',
            port: redisPort || 6379,
            password: redisPassword,
            db: redisDb || 1,
          },
          defaultJobOptions: {
            attempts: 3,
            removeOnComplete: true,
            removeOnFail: false,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        };
      },
    }),
  ],
  providers: [
    EmailService,
    EmailProcessor,
    EmailConsumer,
    {
      provide: 'QUEUE_HEALTH_CHECK',
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('EmailQueueHealthCheck');
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT');
        const password = configService.get<string>('REDIS_PASSWORD');

        logger.log('Initializing email queue health check service');

        // Create a Redis client to test connectivity
        try {
          const redis = new Redis({
            host: host || 'localhost',
            port: port || 6379,
            password: password || undefined,
            connectTimeout: 5000, // 5 seconds
          });

          // Test the connection works
          await redis.ping();
          logger.log('Redis connection successful, health check is ready');

          return {
            // Method to check if the queue is healthy
            check: async () => {
              try {
                await redis.ping();
                return { status: 'ok', message: 'Queue service is available' };
              } catch (error: unknown) {
                // Type guard to check if error is an object with a message property
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred';

                logger.error(`Queue health check failed: ${errorMessage}`);
                return {
                  status: 'error',
                  message: `Queue service unavailable: ${errorMessage}`,
                };
              }
            },
          };
        } catch (error: unknown) {
          // Type guard to check if error is an object with a message property
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred';

          logger.error(
            `Failed to initialize queue health check: ${errorMessage}`,
          );

          // Return a health check that always fails
          return {
            check: async () => ({
              status: 'error',
              message: 'Queue health check initialization failed',
            }),
          };
        }
      },
      inject: [ConfigService],
    },
  ],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit {
  private readonly logger = new Logger(EmailModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    try {
      // Register template helpers for email rendering
      registerTemplateHelpers();
      this.logger.log('Email template helpers registered successfully');

      // Verify that required environment variables are set
      this.verifyConfiguration();
    } catch (error) {
      this.logger.error(
        `Error during EmailModule initialization: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private verifyConfiguration(): void {
    // Check for critical configuration
    const smtpServer = this.configService.get<string>('SMTP_SERVER');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const senderEmail = this.configService.get<string>('SENDER_EMAIL');

    if (!smtpServer) {
      this.logger.warn('SMTP_SERVER environment variable is not set');
    }

    if (!smtpUser) {
      this.logger.warn('SMTP_USER environment variable is not set');
    }

    if (!smtpPass) {
      this.logger.warn('SMTP_PASS environment variable is not set');
    }

    if (!senderEmail) {
      this.logger.warn('SENDER_EMAIL environment variable is not set');
    }

    // Warn about common configuration issues
    if (smtpServer?.includes('defaultSmtpServer')) {
      this.logger.warn(
        'Using default SMTP server, emails may not be delivered',
      );
    }

    if (senderEmail?.includes('example.com')) {
      this.logger.warn(
        'Using example.com sender email, which may affect deliverability',
      );
    }
  }
}
