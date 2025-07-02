import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemAlert } from '../entities/system-alert.entity';
import { AuditService } from './audit.service';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AlertCategory {
  SYSTEM = 'system',
  SECURITY = 'security',
  PAYMENT = 'payment',
  USER = 'user',
  SUBSCRIPTION = 'subscription',
  PERFORMANCE = 'performance',
}

// In alert.service.ts or a separate types file
export interface AlertConfig {
  level?: AlertSeverity; // Make optional
  severity?: AlertSeverity; // Add this alternative
  category: AlertCategory;
  title: string;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  source: string;
  requiresAction?: boolean;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly alertThresholds: Record<string, number> = {
    HIGH_PAYMENT_FAILURE_COUNT: 5, // in last 24 hours
    CHURN_SPIKE_PERCENTAGE: 10, // 10% above normal
    FAILED_PAYMENT_PERCENTAGE: 15, // 15% of total payments
    REFUND_PERCENTAGE_THRESHOLD: 8, // 8% of total payments
    SUSPICIOUS_ACTIVITY_THRESHOLD: 3, // 3 failed payment attempts
  };

  constructor(
    @InjectRepository(SystemAlert)
    private readonly alertRepository: Repository<SystemAlert>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Load alert thresholds from config if available
    const configThresholds = this.configService.get('alertThresholds');
    if (configThresholds) {
      this.alertThresholds = { ...this.alertThresholds, ...configThresholds };
    }
  }

  /**
   * Create a new system alert
   */
  async createAlert(config: AlertConfig): Promise<SystemAlert | null> {
    try {
      // Use severity if provided, otherwise use level, or default to INFO
      const alertSeverity =
        config.severity || config.level || AlertSeverity.INFO;

      const alert = this.alertRepository.create({
        severity: alertSeverity,
        category: config.category,
        title: config.title,
        message: config.message,
        details: config.details,
        userId: config.userId,
        source: config.source,
        requiresAction: config.requiresAction || false,
        createdAt: new Date(),
      });

      return await this.alertRepository.save(alert);
    } catch (error: unknown) {
      // Safe error handling
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Error creating alert: ${errorMessage}`, errorStack);
      return null;
    }
  }

  /**
   * Create a payment failure alert
   */
  async createPaymentFailureAlert(data: {
    userId: string;
    paymentId: string;
    amount: number;
    currency: string;
    errorMessage: string;
    errorCode?: string;
    paymentMethod?: string;
  }): Promise<SystemAlert | null> {
    const alertConfig = {
      severity: AlertSeverity.ERROR,
      category: AlertCategory.PAYMENT,
      title: 'Payment Processing Failed',
      message: `Payment of ${data.amount} ${data.currency} failed: ${data.errorMessage}`,
      details: {
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        errorCode: data.errorCode,
        paymentMethod: data.paymentMethod,
      },
      userId: data.userId,
      source: 'payment_processor',
      requiresAction: true,
    };

    const alert = await this.createAlert(alertConfig);
    if (alert) {
      // Use the alert
    } else {
      // Handle null case
      this.logger.warn(
        `Failed to create payment failure alert for user ${data.userId}`,
      );
    }

    return alert;
  }

  /**
   * Create a subscription cancellation alert
   */
  async createSubscriptionCancellationAlert(data: {
    userId: string;
    subscriptionId: string;
    reason?: string;
    effectiveDate: Date;
  }): Promise<SystemAlert | null> {
    return this.createAlert({
      severity: AlertSeverity.WARNING,
      category: AlertCategory.SUBSCRIPTION,
      title: 'Subscription Canceled',
      message: `User ${data.userId} canceled subscription ${data.subscriptionId}${data.reason ? ` - Reason: ${data.reason}` : ''}`,
      details: {
        subscriptionId: data.subscriptionId,
        reason: data.reason,
        effectiveDate: data.effectiveDate,
      },
      userId: data.userId,
      source: 'subscription_service',
    });
  }

  /**
   * Create an alert for suspicious payment activity
   */
  async createSuspiciousActivityAlert(data: {
    userId: string;
    attempts: number;
    timeFrameMinutes: number;
    ipAddress?: string;
  }): Promise<SystemAlert | null> {
    return this.createAlert({
      severity: AlertSeverity.WARNING,
      category: AlertCategory.SECURITY,
      title: 'Suspicious Payment Activity',
      message: `User ${data.userId} made ${data.attempts} failed payment attempts in ${data.timeFrameMinutes} minutes`,
      details: {
        attempts: data.attempts,
        timeFrameMinutes: data.timeFrameMinutes,
        ipAddress: data.ipAddress,
      },
      userId: data.userId,
      source: 'security_monitor',
      requiresAction: true,
    });
  }

  /**
   * Create a refund alert
   */
  async createRefundAlert(data: {
    userId: string;
    paymentId: string;
    refundId: string;
    amount: number;
    currency: string;
    reason: string;
    issuedByUserId: string;
  }): Promise<SystemAlert | null> {
    return this.createAlert({
      severity: AlertSeverity.INFO,
      category: AlertCategory.PAYMENT,
      title: 'Payment Refunded',
      message: `Payment ${data.paymentId} refunded: ${data.amount} ${data.currency}`,
      details: {
        paymentId: data.paymentId,
        refundId: data.refundId,
        amount: data.amount,
        currency: data.currency,
        reason: data.reason,
        issuedByUserId: data.issuedByUserId,
      },
      userId: data.userId,
      source: 'payment_processor',
    });
  }

  /**
   * Create a payment churn rate alert
   */
  async createChurnRateAlert(data: {
    period: string;
    churnRate: number;
    previousRate: number;
    percentageIncrease: number;
  }): Promise<SystemAlert | null> {
    return this.createAlert({
      severity:
        data.percentageIncrease > this.alertThresholds.CHURN_SPIKE_PERCENTAGE
          ? AlertSeverity.ERROR
          : AlertSeverity.WARNING,
      category: AlertCategory.SUBSCRIPTION,
      title: 'Churn Rate Spike Detected',
      message: `Churn rate increased by ${data.percentageIncrease.toFixed(2)}% (from ${data.previousRate.toFixed(2)}% to ${data.churnRate.toFixed(2)}%)`,
      details: {
        period: data.period,
        churnRate: data.churnRate,
        previousRate: data.previousRate,
        percentageIncrease: data.percentageIncrease,
      },
      source: 'analytics_service',
      requiresAction:
        data.percentageIncrease > this.alertThresholds.CHURN_SPIKE_PERCENTAGE,
    });
  }

  /**
   * Mark an alert as resolved
   */
  async resolveAlert(
    alertId: string,
    userId: string,
    details?: Record<string, any>,
  ): Promise<SystemAlert | null> {
    try {
      const alert = await this.alertRepository.findOne({
        where: { id: alertId },
      });

      if (!alert) {
        this.logger.warn(`Attempt to resolve non-existent alert: ${alertId}`);
        return null;
      }

      alert.actionTaken = true;
      alert.resolvedAt = new Date();
      alert.resolvedBy = userId;
      alert.resolvedDetails = details || {};

      const updatedAlert = await this.alertRepository.save(alert);

      // Emit alert resolved event
      this.eventEmitter.emit('alert.resolved', updatedAlert);

      // Add to audit log
      await this.auditService.logAction({
        userId,
        action: 'alert.resolved',
        details: {
          alertId,
          category: alert.category,
          severity: alert.severity,
          title: alert.title,
          resolvedDetails: details,
        },
      });

      return updatedAlert;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Error resolving alert: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Error resolving alert: Unknown error');
      }
      return null;
    }
  }

  /**
   * Get all active alerts that require action
   */
  async getActiveAlerts(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ alerts: SystemAlert[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: {
        requiresAction: true,
        actionTaken: false,
      },
      order: {
        severity: 'ASC', // CRITICAL first
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total };
  }

  /**
   * Get alerts by category
   */
  async getAlertsByCategory(
    category: AlertCategory,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ alerts: SystemAlert[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: { category },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total };
  }

  /**
   * Get alerts by user ID
   */
  async getAlertsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ alerts: SystemAlert[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total };
  }

  /**
   * Get alerts by severity
   */
  async getAlertsBySeverity(
    severity: AlertSeverity,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ alerts: SystemAlert[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: { severity },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total };
  }

  /**
   * Get alerts by date range
   */
  async getAlertsByDateRange(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ alerts: SystemAlert[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total };
  }

  /**
   * Monitor payment failure rate and alert if over threshold
   */
  async monitorPaymentFailureRate(data: {
    totalPayments: number;
    failedPayments: number;
    period: string;
  }): Promise<SystemAlert | null> {
    if (data.totalPayments === 0) return null;

    const failureRate = (data.failedPayments / data.totalPayments) * 100;

    if (failureRate > this.alertThresholds.FAILED_PAYMENT_PERCENTAGE) {
      return this.createAlert({
        severity: AlertSeverity.ERROR,
        category: AlertCategory.PAYMENT,
        title: 'High Payment Failure Rate',
        message: `Payment failure rate of ${failureRate.toFixed(2)}% exceeds threshold of ${this.alertThresholds.FAILED_PAYMENT_PERCENTAGE}%`,
        details: {
          totalPayments: data.totalPayments,
          failedPayments: data.failedPayments,
          failureRate,
          period: data.period,
          threshold: this.alertThresholds.FAILED_PAYMENT_PERCENTAGE,
        },
        source: 'payment_analytics',
        requiresAction: true,
      });
    }

    return null;
  }

  /**
   * Monitor refund rate and alert if over threshold
   */
  async monitorRefundRate(data: {
    totalPayments: number;
    refundedPayments: number;
    period: string;
  }): Promise<SystemAlert | null> {
    if (data.totalPayments === 0) return null;

    const refundRate = (data.refundedPayments / data.totalPayments) * 100;

    if (refundRate > this.alertThresholds.REFUND_PERCENTAGE_THRESHOLD) {
      return this.createAlert({
        severity: AlertSeverity.WARNING,
        category: AlertCategory.PAYMENT,
        title: 'High Refund Rate',
        message: `Refund rate of ${refundRate.toFixed(2)}% exceeds threshold of ${this.alertThresholds.REFUND_PERCENTAGE_THRESHOLD}%`,
        details: {
          totalPayments: data.totalPayments,
          refundedPayments: data.refundedPayments,
          refundRate,
          period: data.period,
          threshold: this.alertThresholds.REFUND_PERCENTAGE_THRESHOLD,
        },
        source: 'payment_analytics',
        requiresAction: true,
      });
    }

    return null;
  }

  /**
   * Get a summary of alerts by category and severity
   */
  async getAlertSummary(): Promise<Record<string, any>> {
    const categoryCounts = await this.alertRepository
      .createQueryBuilder('alert')
      .select('alert.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('alert.category')
      .getRawMany();

    const severityCounts = await this.alertRepository
      .createQueryBuilder('alert')
      .select('alert.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('alert.severity')
      .getRawMany();

    const actionRequiredCount = await this.alertRepository.count({
      where: {
        requiresAction: true,
        actionTaken: false,
      },
    });

    const last24HoursCount = await this.alertRepository.count({
      where: {
        createdAt: MoreThanOrEqual(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      },
    });

    return {
      bySeverity: severityCounts.reduce((acc, curr) => {
        acc[curr.severity] = parseInt(curr.count, 10);
        return acc;
      }, {}),
      byCategory: categoryCounts.reduce((acc, curr) => {
        acc[curr.category] = parseInt(curr.count, 10);
        return acc;
      }, {}),
      actionRequired: actionRequiredCount,
      last24Hours: last24HoursCount,
    };
  }
}
