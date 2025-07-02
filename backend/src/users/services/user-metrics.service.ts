import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { StorageQuota } from '../../upload/entities/storage-quota.entity';

interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<UserRole, number>;
  storageUsage: {
    total: number;
    used: number;
    averagePerUser: number;
  };
  verificationRate: number;
  completionRate: number;
}

interface UserActivityMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
}

@Injectable()
export class UserMetricsService {
  private readonly logger = new Logger(UserMetricsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
  ) {}

  async getUserMetrics(): Promise<UserMetrics> {
    try {
      // Get total users
      const [totalUsers, activeUsers] = await Promise.all([
        this.userRepository.count(),
        this.userRepository.count({ where: { isActive: true } }),
      ]);

      // Get users by role
      const usersByRole = await this.getUsersByRole();

      // Get storage metrics
      const storageMetrics = await this.getStorageMetrics();

      // Get verification and completion rates
      const [verificationRate, completionRate] = await Promise.all([
        this.calculateVerificationRate(),
        this.calculateProfileCompletionRate(),
      ]);

      return {
        totalUsers,
        activeUsers,
        usersByRole,
        storageUsage: storageMetrics,
        verificationRate,
        completionRate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getUserActivityMetrics(): Promise<UserActivityMetrics> {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [dailyActive, weeklyActive, monthlyActive] = await Promise.all([
        this.userRepository.count({
          where: { lastLoginAt: MoreThanOrEqual(dayAgo) },
        }),
        this.userRepository.count({
          where: { lastLoginAt: MoreThanOrEqual(weekAgo) },
        }),
        this.userRepository.count({
          where: { lastLoginAt: MoreThanOrEqual(monthAgo) },
        }),
      ]);

      // Calculate average session duration
      const averageSessionDuration =
        await this.calculateAverageSessionDuration();

      return {
        dailyActiveUsers: dailyActive,
        weeklyActiveUsers: weeklyActive,
        monthlyActiveUsers: monthlyActive,
        averageSessionDuration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user activity metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async getUsersByRole(): Promise<Record<UserRole, number>> {
    const roleCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    return roleCounts.reduce(
      (acc, { role, count }) => {
        acc[role] = parseInt(count);
        return acc;
      },
      {} as Record<UserRole, number>,
    );
  }

  private async getStorageMetrics(): Promise<{
    total: number;
    used: number;
    averagePerUser: number;
  }> {
    const quotas = await this.quotaRepository.find();

    const total = quotas.reduce((sum, quota) => sum + quota.totalSpace, 0);
    const used = quotas.reduce((sum, quota) => sum + quota.usedSpace, 0);
    const averagePerUser = quotas.length > 0 ? used / quotas.length : 0;

    return { total, used, averagePerUser };
  }

  private async calculateVerificationRate(): Promise<number> {
    const [verified, total] = await Promise.all([
      this.userRepository.count({ where: { emailVerified: true } }),
      this.userRepository.count(),
    ]);

    return total > 0 ? (verified / total) * 100 : 0;
  }

  private async calculateProfileCompletionRate(): Promise<number> {
    const users = await this.userRepository.find();
    const completed = users.filter((user) => user.hasCompletedProfile()).length;

    return users.length > 0 ? (completed / users.length) * 100 : 0;
  }

  private async calculateAverageSessionDuration(): Promise<number> {
    // This would typically come from your analytics service
    // For now, return a placeholder value
    return 1800; // 30 minutes in seconds
  }
}
