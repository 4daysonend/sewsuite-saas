import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';

// Entity imports
import { User } from './entities/user.entity';
import { StorageQuota } from '../upload/entities/storage-quota.entity';
import { Subscription } from '../payments/entities/subscription.entity';

// Controller imports
import { UsersController } from './users.controller';

// Service imports
import { UsersService } from './users.service';
import { UserProfileService } from './services/user-profile.service';
import { RoleManagementService } from './services/role-management.service';
import { SubscriptionIntegrationService } from './services/subscription-integration.service';
import { UserMetricsService } from './services/user-metrics.service';

// Processor imports
import { UserOperationsProcessor } from './processors/user-operations.processor';

// Utility imports
import { UserQueryBuilder } from './utils/user-query.builder';
import { UserRoleGuard } from './guards/user-role.guard';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([User, StorageQuota, Subscription]),

    // Bull queue for async operations
    BullModule.registerQueue({
      name: 'user-operations',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    }),

    // Configuration module
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [
    // Core services
    UsersService,
    UserProfileService,
    RoleManagementService,
    SubscriptionIntegrationService,
    UserMetricsService,

    // Processor
    UserOperationsProcessor,

    // Utilities
    UserQueryBuilder,
    UserRoleGuard,
  ],
  exports: [
    // Services available to other modules
    UsersService,
    UserProfileService,
    RoleManagementService,
    SubscriptionIntegrationService,
    UserMetricsService,
  ],
})
export class UsersModule {}
