import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditEntry } from './entities/audit-entry.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditEntry)
    private readonly auditRepository: Repository<AuditEntry>,
  ) {}

  /**
   * Create an audit log entry
   * @param data The audit log data
   */
  async createAuditLog(data: {
    userId: string | undefined;
    username: string | undefined;
    action: string;
    resource: string;
    ip: string | undefined;
    details: any;
    severity: 'ERROR' | 'INFO' | 'WARNING';
  }): Promise<AuditEntry> {
    try {
      // Map the incoming parameters to your AuditEntry structure
      const auditEntry = this.auditRepository.create({
        userId: data.userId,
        action: data.action,
        targetType: data.resource,
        details: {
          ...data.details,
          severity: data.severity,
          username: data.username,
        },
        ipAddress: data.ip,
      });

      const savedEntry = await this.auditRepository.save(auditEntry);

      this.logger.debug(
        `Audit log created: ${data.action} on ${data.resource} by user ${data.userId || data.username || 'system'} (${data.severity})`,
      );

      return savedEntry;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to create audit log for action ${data.action}: ${errorMessage}`,
        errorStack,
      );

      // Return a partially constructed audit entry for error handling
      return {
        id: 'error',
        action: data.action,
        targetType: data.resource,
        userId: data.userId,
        details: {
          ...data.details,
          severity: data.severity,
          username: data.username,
        },
        ipAddress: data.ip,
        createdAt: new Date(),
      } as AuditEntry;
    }
  }

  /**
   * Log an audit event
   * @param event The audit event to log
   */
  async logEvent(event: {
    userId?: string;
    action: string;
    targetId?: string;
    targetType: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditEntry> {
    try {
      const auditEntry = this.auditRepository.create(event);
      const savedEntry = await this.auditRepository.save(auditEntry);

      this.logger.debug(
        `Audit log created: ${event.action} on ${event.targetType}${
          event.targetId ? ` (ID: ${event.targetId})` : ''
        } by user ${event.userId || 'system'}`,
      );

      return savedEntry;
    } catch (error) {
      // Log the error but don't re-throw it to prevent disrupting the main application flow
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to create audit log for action ${event.action}: ${errorMessage}`,
        errorStack,
      );

      // Return a partially constructed audit entry for error handling
      return {
        id: 'error',
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        userId: event.userId,
        details: event.details,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        createdAt: new Date(),
      } as AuditEntry;
    }
  }

  /**
   * Query audit logs with filtering options
   */
  async queryLogs(options: {
    userId?: string;
    action?: string;
    targetId?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditEntry[]; total: number }> {
    const {
      userId,
      action,
      targetId,
      targetType,
      startDate,
      endDate,
      limit = 20,
      offset = 0,
    } = options;

    // Build the query conditions
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (targetId) where.targetId = targetId;
    if (targetType) where.targetType = targetType;

    // Add date range condition if provided
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else {
      if (startDate) {
        where.createdAt = MoreThanOrEqual(startDate);
      }
      if (endDate) {
        where.createdAt = LessThanOrEqual(endDate);
      }
    }

    // Execute the query with pagination
    const [logs, total] = await this.auditRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { logs, total };
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    actionCounts: Record<string, number>;
    userActivities: Record<string, number>;
  }> {
    // Set default date range if not provided (last 30 days)
    const end = endDate || new Date();
    const start =
      startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total count using proper TypeORM operators
    const totalEvents = await this.auditRepository.count({
      where: {
        createdAt: Between(start, end),
      },
    });

    // Get count by action
    const actionResults = await this.auditRepository
      .createQueryBuilder('audit')
      .select('audit.action, COUNT(*) as count')
      .where('audit.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('audit.action')
      .getRawMany();

    // Get count by user
    const userResults = await this.auditRepository
      .createQueryBuilder('audit')
      .select('audit.userId, COUNT(*) as count')
      .where('audit.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('audit.userId IS NOT NULL')
      .groupBy('audit.userId')
      .getRawMany();

    // Transform results into record objects
    const actionCounts = actionResults.reduce(
      (acc, curr) => {
        acc[curr.audit_action] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const userActivities = userResults.reduce(
      (acc, curr) => {
        acc[curr.audit_userId] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return { totalEvents, actionCounts, userActivities };
  }
}
