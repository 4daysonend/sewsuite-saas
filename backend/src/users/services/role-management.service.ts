import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { StorageQuota } from '../../upload/entities/storage-quota.entity';

@Injectable()
export class RoleManagementService {
  private readonly logger = new Logger(RoleManagementService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
  ) {}

  async updateUserRole(userId: string, newRole: UserRole): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['subscriptions'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const oldRole = user.role;
    user.role = newRole;

    // Handle role-specific updates
    switch (newRole) {
      case UserRole.TAILOR:
        await this.handleTailorRoleUpgrade(user);
        break;
      case UserRole.CLIENT:
        if (oldRole === UserRole.TAILOR) {
          await this.handleTailorRoleDowngrade(user);
        }
        break;
      case UserRole.ADMIN:
        await this.verifyAdminEligibility(user);
        break;
    }

    // Update storage quotas based on new role
    await this.updateRoleBasedQuota(user, newRole);

    return this.userRepository.save(user);
  }

  private async handleTailorRoleUpgrade(user: User): Promise<void> {
    if (!user.emailVerified) {
      throw new BadRequestException(
        'Email must be verified to become a tailor',
      );
    }

    if (!user.hasCompletedProfile()) {
      throw new BadRequestException(
        'Profile must be completed to become a tailor',
      );
    }

    // Verify any subscription requirements
    const hasRequiredSubscription = user.subscriptions?.some(
      (sub) =>
        sub.status === 'active' && ['pro', 'business'].includes(sub.planId),
    );

    if (!hasRequiredSubscription) {
      throw new BadRequestException(
        'Active business subscription required for tailor role',
      );
    }

    // Initialize tailor-specific data
    await this.initializeTailorProfile(user);
  }

  private async handleTailorRoleDowngrade(user: User): Promise<void> {
    // Archive tailor data
    await this.archiveTailorProfile(user);

    // Update related records
    await this.handleTailorDataArchival(user.id);
  }

  private async verifyAdminEligibility(user: User): Promise<void> {
    if (!user.emailVerified) {
      throw new BadRequestException(
        'Email must be verified to become an admin',
      );
    }

    if (!user.hasCompletedProfile()) {
      throw new BadRequestException(
        'Profile must be completed to become an admin',
      );
    }

    // Additional admin verification could be added here
  }

  private async updateRoleBasedQuota(
    user: User,
    role: UserRole,
  ): Promise<void> {
    const quota = await this.quotaRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!quota) {
      throw new BadRequestException('Storage quota not found');
    }

    // Update quota based on role
    switch (role) {
      case UserRole.CLIENT:
        quota.totalSpace = 1073741824; // 1GB
        break;
      case UserRole.TAILOR:
        quota.totalSpace = 10737418240; // 10GB
        break;
      case UserRole.ADMIN:
        quota.totalSpace = 107374182400; // 100GB
        break;
    }

    await this.quotaRepository.save(quota);
  }

  private async initializeTailorProfile(user: User): Promise<void> {
    // Initialize tailor-specific settings and data
    // This could include:
    // - Creating a public profile
    // - Setting up availability calendar
    // - Initializing service offerings
    // - Setting up payment processing
    this.logger.log(`Initializing tailor profile for user ${user.id}`);
  }

  private async archiveTailorProfile(user: User): Promise<void> {
    // Archive tailor-specific data
    // This could include:
    // - Archiving public profile
    // - Handling active orders
    // - Updating service listings
    this.logger.log(`Archiving tailor profile for user ${user.id}`);
  }

  private async handleTailorDataArchival(userId: string): Promise<void> {
    // Update related records when tailor role is removed
    // This could include:
    // - Handling open orders
    // - Updating customer assignments
    // - Archiving reviews
    this.logger.log(`Handling tailor data archival for user ${userId}`);
  }
}
