import { UserRole } from '../entities/user.entity';

export interface UserMetrics {
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

export interface UserActivityMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
}

export interface UserGrowthMetrics {
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  growth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface UserRetentionMetrics {
  retentionRate: number;
  churnRate: number;
  averageLifespan: number;
  returningUsers: number;
}
