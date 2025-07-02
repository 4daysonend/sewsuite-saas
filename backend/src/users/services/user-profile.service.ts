import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { StorageQuota } from '../../upload/entities/storage-quota.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserPreferencesDto } from '../dto/user-preferences.dto';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
  ) {}

  async updateProfile(userId: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Track if this is first time profile completion
    const wasProfileComplete = user.hasCompletedProfile();

    // Update user properties
    Object.assign(user, updateDto);

    // Check if profile is now complete
    const isProfileComplete = user.hasCompletedProfile();

    const updatedUser = await this.userRepository.save(user);

    // Handle first time profile completion
    if (!wasProfileComplete && isProfileComplete) {
      await this.handleProfileCompletion(updatedUser);
    }

    return updatedUser;
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferencesDto>,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.preferences = {
      ...user.preferences,
      ...preferences,
    };

    return this.userRepository.save(user);
  }

  async getStorageQuota(userId: string): Promise<StorageQuota> {
    const quota = await this.quotaRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!quota) {
      throw new NotFoundException('Storage quota not found');
    }

    return quota;
  }

  private async handleProfileCompletion(user: User): Promise<void> {
    this.logger.log(
      `User ${user.id} completed their profile for the first time`,
    );

    // Here you could:
    // - Send welcome email
    // - Grant initial storage quota
    // - Add welcome notification
    // - Trigger any onboarding workflows
  }
}
