import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThan } from 'typeorm';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly retentionDays: number;
  private readonly isEnabled: boolean;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    // Use the configService
    this.retentionDays =
      this.configService.get<number>('AUDIT_RETENTION_DAYS') || 90;
    this.isEnabled =
      this.configService.get<boolean>('ENABLE_AUDIT_LOGGING') !== false;

    this.logger.log(
      `Audit service initialized. Retention: ${this.retentionDays} days, Enabled: ${this.isEnabled}`,
    );
  }

  /**
   * Log an action for audit purposes
   */
  async logAction(data: {
    userId: string;
    action: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog | null> {
    // Skip logging if not enabled
    if (!this.isEnabled) {
      return null;
    }

    try {
      const auditLog = this.auditLogRepository.create({
        userId: data.userId,
        action: data.action,
        details: data.details || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        createdAt: new Date(),
      });

      return await this.auditLogRepository.save(auditLog);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error logging audit action: ${errorMessage}`,
        errorStack,
      );
      return null;
    }
  }

  /**
   * Get recent audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving user audit logs: ${errorMessage}`,
        errorStack,
      );
      return [];
    }
  }

  /**
   * Get audit logs for specific actions
   */
  async getActionAuditLogs(
    actions: string[],
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action: In(actions) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get all audit logs with pagination
   */
  async getAllAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters?: Record<string, any>,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    // Apply filters
    if (filters) {
      if (filters.userId) {
        query.andWhere('audit.userId = :userId', { userId: filters.userId });
      }

      if (filters.action) {
        query.andWhere('audit.action = :action', { action: filters.action });
      }

      if (filters.startDate) {
        query.andWhere('audit.createdAt >= :startDate', {
          startDate: new Date(filters.startDate),
        });
      }

      if (filters.endDate) {
        query.andWhere('audit.createdAt <= :endDate', {
          endDate: new Date(filters.endDate),
        });
      }
    }

    // Add sorting
    query.orderBy('audit.createdAt', 'DESC');

    // Add pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    // Execute
    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const result = await this.auditLogRepository.delete({
        createdAt: LessThan(cutoffDate),
      });

      this.logger.log(
        `Cleaned up ${result.affected || 0} audit logs older than ${this.retentionDays} days`,
      );

      return result.affected || 0;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error cleaning up audit logs: ${errorMessage}`,
        errorStack,
      );
      return 0;
    }
  }
}
