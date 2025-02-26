import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { StorageQuota } from '../../upload/entities/storage-quota.entity';
import { ConfigService } from '@nestjs/config';

interface UserOperationJob {
  userId: string;
  operation: 'initialize' | 'cleanup' | 'update-quota' | 'archive';
  data?: Record<string, any>;
}

@Processor('user-operations')
export class UserOperationsProcessor {
  private readonly logger = new Logger(UserOperationsProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
    private readonly configService: ConfigService,
  ) {}

  @Process('initialize-user')
  async handleInitialization(job: Job<UserOperationJob>): Promise<void> {
    const { userId, data } = job.data;
    this.logger.debug(`Initializing user: ${userId}`);

    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Initialize storage quota
      await this.initializeStorageQuota(user, data?.quotaSize);

      // Initialize other user resources
      await this.initializeUserResources(user);

      this.logger.debug(`User initialization completed: ${userId}`);
    } catch (error) {
      this.logger.error(
        `User initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Process('cleanup-user')
  async handleCleanup(job: Job<UserOperationJob>): Promise<void> {
    const { userId } = job.data;
    this.logger.debug(`Cleaning up user data: ${userId}`);

    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Archive user data
      await this.archiveUserData(user);

      // Clean up resources
      await this.cleanupUserResources(user);

      this.logger.debug(`User cleanup completed: ${userId}`);
    } catch (error) {
      this.logger.error(
        `User cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Process('update-quota')
  async handleQuotaUpdate(job: Job<UserOperationJob>): Promise<void> {
    const { userId, data } = job.data;
    this.logger.debug(`Updating quota for user: ${userId}`);

    try {
      const quota = await this.quotaRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!quota) {
        throw new Error(`Quota not found for user: ${userId}`);
      }

      // Update quota based on subscription or role changes
      quota.totalSpace = data?.newQuota || quota.totalSpace;
      await this.quotaRepository.save(quota);

      this.logger.debug(`Quota update completed for user: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Quota update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async initializeStorageQuota(
    user: User,
    quotaSize?: number,
  ): Promise<void> {
    const defaultQuota =
      quotaSize ||
      this.configService.get<number>('DEFAULT_STORAGE_QUOTA', 1073741824); // 1GB default

    await this.quotaRepository.save({
      user: { id: user.id },
      totalSpace: defaultQuota,
      usedSpace: 0,
      quotaByCategory: {},
    });
  }

  private async initializeUserResources(user: User): Promise<void> {
    // Initialize any additional user resources
    // This could include:
    // - Setting up personal workspace
    // - Creating default folders
    // - Setting up default preferences
    this.logger.debug(`Initializing resources for user: ${user.id}`);
  }

  private async archiveUserData(user: User): Promise<void> {
    // Archive user's data before cleanup
    // This could include:
    // - Exporting user data
    // - Creating backup
    // - Marking records as archived
    this.logger.debug(`Archiving data for user: ${user.id}`);
  }

  private async cleanupUserResources(user: User): Promise<void> {
    // Clean up user's resources
    // This could include:
    // - Removing temporary files
    // - Cleaning up storage
    // - Removing workspace
    this.logger.debug(`Cleaning up resources for user: ${user.id}`);
  }
}
