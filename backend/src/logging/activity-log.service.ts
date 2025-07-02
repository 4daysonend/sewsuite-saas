import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';

interface CreateActivityLogDto {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
}

interface FindActivityLogOptions {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Create a new activity log entry
   */
  async create(
    createActivityLogDto: CreateActivityLogDto,
  ): Promise<ActivityLog> {
    const activityLog = this.activityLogRepository.create({
      userId: createActivityLogDto.userId,
      action: createActivityLogDto.action,
      resourceType: createActivityLogDto.resourceType,
      resourceId: createActivityLogDto.resourceId,
      details: createActivityLogDto.details,
    });

    return await this.activityLogRepository.save(activityLog);
  }

  /**
   * Find activity logs by various criteria
   */
  async findAll(options: FindActivityLogOptions = {}): Promise<ActivityLog[]> {
    const query = this.activityLogRepository.createQueryBuilder('activity_log');

    if (options.userId) {
      query.andWhere('activity_log.userId = :userId', {
        userId: options.userId,
      });
    }

    if (options.action) {
      query.andWhere('activity_log.action = :action', {
        action: options.action,
      });
    }

    if (options.resourceType) {
      query.andWhere('activity_log.resourceType = :resourceType', {
        resourceType: options.resourceType,
      });
    }

    if (options.resourceId) {
      query.andWhere('activity_log.resourceId = :resourceId', {
        resourceId: options.resourceId,
      });
    }

    if (options.startDate) {
      query.andWhere('activity_log.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      query.andWhere('activity_log.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    query.orderBy('activity_log.createdAt', 'DESC');

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    return await query.getMany();
  }

  /**
   * Find an activity log by ID
   */
  async findOne(id: string): Promise<ActivityLog | null> {
    return await this.activityLogRepository.findOne({ where: { id } });
  }

  /**
   * Get user activity history
   */
  async getUserActivityHistory(
    userId: string,
    limit = 20,
  ): Promise<ActivityLog[]> {
    return await this.findAll({
      userId,
      limit,
    });
  }

  /**
   * Get resource activity history
   */
  async getResourceActivityHistory(
    resourceType: string,
    resourceId: string,
    limit = 20,
  ): Promise<ActivityLog[]> {
    return await this.findAll({
      resourceType,
      resourceId,
      limit,
    });
  }

  /**
   * Delete old activity logs to prevent database bloat
   * @param olderThan Date before which logs should be deleted
   */
  async deleteOld(olderThan: Date): Promise<number> {
    const result = await this.activityLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :olderThan', { olderThan })
      .execute();

    return result.affected || 0;
  }

  /**
   * Get activity statistics
   * Returns counts grouped by action and resourceType
   */
  async getActivityStats(startDate: Date, endDate: Date): Promise<any[]> {
    const stats = await this.activityLogRepository
      .createQueryBuilder('activity_log')
      .select('activity_log.action', 'action')
      .addSelect('activity_log.resourceType', 'resourceType')
      .addSelect('COUNT(activity_log.id)', 'count')
      .where('activity_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('activity_log.action, activity_log.resourceType')
      .orderBy('count', 'DESC')
      .getRawMany();

    return stats.map((item) => ({
      action: item.action,
      resourceType: item.resourceType,
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * Get most active users
   */
  async getMostActiveUsers(
    startDate: Date,
    endDate: Date,
    limit = 10,
  ): Promise<any[]> {
    const stats = await this.activityLogRepository
      .createQueryBuilder('activity_log')
      .select('activity_log.userId', 'userId')
      .addSelect('COUNT(activity_log.id)', 'count')
      .where('activity_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('activity_log.userId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return stats.map((item) => ({
      userId: item.userId,
      count: parseInt(item.count, 10),
    }));
  }
}
