import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLog } from './entities/security-log.entity';

interface CreateSecurityLogDto {
  action: string;
  userId?: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  status?: 'success' | 'failure';
}

interface FindSecurityLogOptions {
  action?: string;
  userId?: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SecurityLogService {
  constructor(
    @InjectRepository(SecurityLog)
    private securityLogRepository: Repository<SecurityLog>,
  ) {}

  /**
   * Create a new security log entry
   */
  async create(
    createSecurityLogDto: CreateSecurityLogDto,
  ): Promise<SecurityLog> {
    const securityLog = this.securityLogRepository.create({
      action: createSecurityLogDto.action,
      userId: createSecurityLogDto.userId,
      targetId: createSecurityLogDto.targetId,
      targetType: createSecurityLogDto.targetType,
      ipAddress: createSecurityLogDto.ipAddress,
      userAgent: createSecurityLogDto.userAgent,
      metadata: createSecurityLogDto.metadata,
      status: createSecurityLogDto.status,
    });

    return await this.securityLogRepository.save(securityLog);
  }

  /**
   * Find security logs by various criteria
   */
  async findAll(options: FindSecurityLogOptions = {}): Promise<SecurityLog[]> {
    const query = this.securityLogRepository.createQueryBuilder('security_log');

    if (options.action) {
      query.andWhere('security_log.action = :action', {
        action: options.action,
      });
    }

    if (options.userId) {
      query.andWhere('security_log.userId = :userId', {
        userId: options.userId,
      });
    }

    if (options.targetId) {
      query.andWhere('security_log.targetId = :targetId', {
        targetId: options.targetId,
      });
    }

    if (options.targetType) {
      query.andWhere('security_log.targetType = :targetType', {
        targetType: options.targetType,
      });
    }

    if (options.ipAddress) {
      query.andWhere('security_log.ipAddress = :ipAddress', {
        ipAddress: options.ipAddress,
      });
    }

    if (options.status) {
      query.andWhere('security_log.status = :status', {
        status: options.status,
      });
    }

    if (options.startDate) {
      query.andWhere('security_log.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      query.andWhere('security_log.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    query.orderBy('security_log.createdAt', 'DESC');

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    return await query.getMany();
  }

  /**
   * Find a security log by ID
   */
  async findOne(id: string): Promise<SecurityLog | null> {
    return await this.securityLogRepository.findOne({ where: { id } });
  }

  /**
   * Delete old security logs to prevent database bloat
   * @param olderThan Date before which logs should be deleted
   */
  async deleteOld(olderThan: Date): Promise<number> {
    const result = await this.securityLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :olderThan', { olderThan })
      .execute();

    return result.affected || 0;
  }

  /**
   * Find suspicious activities
   * This method looks for repeated failed login attempts,
   * permission escalations, and other potentially suspicious activities
   */
  async findSuspiciousActivities(
    timeWindow: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
  ): Promise<{
    suspiciousLogins: any[];
    permissionChanges: SecurityLog[];
    passwordResets: SecurityLog[];
  }> {
    // Find IPs with multiple failed login attempts
    const suspiciousLogins = await this.securityLogRepository
      .createQueryBuilder('security_log')
      .select('security_log.ipAddress', 'ipAddress')
      .addSelect('COUNT(*)', 'count')
      .where('security_log.action = :action', { action: 'login' })
      .andWhere('security_log.status = :status', { status: 'failure' })
      .andWhere('security_log.createdAt >= :timeWindow', { timeWindow })
      .groupBy('security_log.ipAddress')
      .having('COUNT(*) >= :threshold', { threshold: 5 })
      .getRawMany();

    // Find users with permission changes
    const permissionChanges = await this.securityLogRepository
      .createQueryBuilder('security_log')
      .where('security_log.action LIKE :action', { action: '%permission%' })
      .andWhere('security_log.createdAt >= :timeWindow', { timeWindow })
      .getMany();

    // Find password resets
    const passwordResets = await this.securityLogRepository
      .createQueryBuilder('security_log')
      .where('security_log.action = :action', { action: 'password_reset' })
      .andWhere('security_log.createdAt >= :timeWindow', { timeWindow })
      .getMany();

    return {
      suspiciousLogins,
      permissionChanges,
      passwordResets,
    };
  }

  /**
   * Get security event statistics
   * Returns counts grouped by action and status
   */
  async getSecurityStats(startDate: Date, endDate: Date): Promise<any[]> {
    const stats = await this.securityLogRepository
      .createQueryBuilder('security_log')
      .select('security_log.action', 'action')
      .addSelect('security_log.status', 'status')
      .addSelect('COUNT(security_log.id)', 'count')
      .where('security_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('security_log.action, security_log.status')
      .orderBy('count', 'DESC')
      .getRawMany();

    return stats.map((item) => ({
      action: item.action,
      status: item.status,
      count: parseInt(item.count, 10),
    }));
  }
}
