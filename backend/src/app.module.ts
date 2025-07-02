import {
  Module,
  NestModule,
  MiddlewareConsumer,
  ValidationPipe,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import {
  ConnectionsModule,
  ConnectionTrackingMiddleware,
} from './common/services/connections-manager.service';
import { APP_PIPE, APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { OrdersModule } from './orders/orders.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MetricsModule } from './metrics/metrics.module';
import { LoggingModule } from './logging/logging.module';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { validationSchema } from './config/validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadModule } from './upload/upload.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { RawBodyMiddleware } from './common/middleware/raw-body.middleware';
import { JsonBodyMiddleware } from './payments/middleware/raw-body.middleware';
import { PaymentsModule } from './payments/payments.module';
import { ConfigValidationService } from './config/config.validation.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import * as express from 'express';
import { StripeEvent } from './payments/entities/stripe-event.entity';
import { VaultService } from './config/vault.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      envFilePath: [
        `.env.${process.env.NODE_ENV}.local`,
        `.env.${process.env.NODE_ENV}`,
        '.env.local',
        '.env',
      ],
      // Load env files in development, use Vault in production
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: configService.get<number>('POSTGRES_PORT'),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        ssl: configService.get<string>('NODE_ENV') === 'production',
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.get<string>('MONGODB_URI')) {
          return { uri: configService.get<string>('MONGODB_URI') };
        }

        return {
          uri: `mongodb://${configService.get<string>('MONGODB_USER')}:${configService.get<string>('MONGODB_PASSWORD')}@${configService.get<string>('MONGODB_HOST')}:${configService.get<number>('MONGODB_PORT')}/${configService.get<string>('MONGODB_DATABASE')}`,
        };
      },
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get<string>('REDIS_PASSWORD'),
        db: configService.get<number>('REDIS_DB'),
        ttl: configService.get<number>('CACHE_TTL'),
        max: configService.get<number>('CACHE_MAX_ITEMS'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: configService.get<number>('RATE_LIMIT_WINDOW') ?? 60,
            limit: configService.get<number>('RATE_LIMIT_MAX_REQUESTS') ?? 100,
          },
        ],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get('REDIS_PORT', '6379')),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get<number>('QUEUE_REDIS_DB'),
        },
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ConnectionsModule,
    UsersModule,
    AuthModule,
    AdminModule,
    OrdersModule,
    EmailModule,
    NotificationsModule,
    AnalyticsModule,
    UploadModule,
    MetricsModule,
    LoggingModule,
    PaymentsModule,
    TypeOrmModule.forFeature([StripeEvent]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ConfigValidationService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    VaultService,
    {
      provide: 'CONFIG_OPTIONS',
      useFactory: (
        vaultService: VaultService,
        configService: ConfigService,
      ) => ({
        getConfig: (key: string) =>
          vaultService.getSecret(key) || configService.get(key),
      }),
      inject: [VaultService, ConfigService],
    },
  ],
  exports: [VaultService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ConnectionTrackingMiddleware).forRoutes('*');
    consumer.apply(RawBodyMiddleware).forRoutes({
      path: '/payments/webhook',
      method: RequestMethod.POST,
    });
    consumer
      .apply(JsonBodyMiddleware)
      .exclude({
        path: '/payments/webhook',
        method: RequestMethod.POST,
      })
      .forRoutes('*');
    consumer.apply(express.json()).forRoutes('/webhooks/stripe');
  }
}
