import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, In, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { AlertService } from '../../common/services/alert.service';
import { MRRDataDto } from '../dto/mrr-data.dto';
import { SubscriptionService } from './subscription.service';

// Export the interface
export interface ChurnData {
  period: string;
  date: string;
  totalCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  previousChurnRate?: number;
}

export interface MRRData {
  date: string;
  mrr: number;
  netNewMRR: number;
  expansionMRR: number;
  churnMRR: number;
}

export interface PaymentFailureAnalytic {
  userId: string;
  failedPayments: number;
  lastFailureDate: Date;
  errorCodes: string[];
}

@Injectable()
export class PaymentAnalyticsService {
  private readonly logger = new Logger(PaymentAnalyticsService.name);
  private readonly alertThresholds: {
    PAYMENT_FAILURE_THRESHOLD: number;
    REFUND_RATE_THRESHOLD: number;
    CHURN_ALERT_PERCENTAGE: number;
  };

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly configService: ConfigService,
    private readonly alertService: AlertService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    // Initialize thresholds from config with defaults
    this.alertThresholds = {
      PAYMENT_FAILURE_THRESHOLD: this.configService.get<number>(
        'PAYMENT_FAILURE_THRESHOLD',
        10,
      ),
      REFUND_RATE_THRESHOLD: this.configService.get<number>(
        'REFUND_RATE_THRESHOLD',
        5,
      ),
      CHURN_ALERT_PERCENTAGE: this.configService.get<number>(
        'CHURN_ALERT_PERCENTAGE',
        10,
      ),
    };

    this.logger.log(
      `Payment analytics initialized with thresholds: ${JSON.stringify(this.alertThresholds)}`,
    );
  }

  // Run daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyMetrics() {
    try {
      this.logger.log('Calculating daily payment metrics');

      // Get payment statistics
      const paymentStats = await this.getPaymentStatistics();

      // Monitor payment failure rate with configurable threshold
      if (paymentStats.totalAttempted > 0) {
        const failureRate =
          (paymentStats.totalFailed / paymentStats.totalAttempted) * 100;

        if (failureRate > this.alertThresholds.PAYMENT_FAILURE_THRESHOLD) {
          await this.alertService.monitorPaymentFailureRate({
            totalPayments: paymentStats.totalAttempted,
            failedPayments: paymentStats.totalFailed,
            period: 'daily',
          });
        }
      }

      // Monitor refund rate with configurable threshold
      if (paymentStats.totalSuccessful > 0) {
        const refundRate =
          (paymentStats.totalRefunded / paymentStats.totalSuccessful) * 100;

        if (refundRate > this.alertThresholds.REFUND_RATE_THRESHOLD) {
          await this.alertService.monitorRefundRate({
            totalPayments: paymentStats.totalSuccessful,
            refundedPayments: paymentStats.totalRefunded,
            period: 'daily',
          });
        }
      }

      // Calculate churn
      const churnDataArray = await this.calculateChurnRate('monthly');

      // Check if we have data and access the first item in the array
      if (churnDataArray.length > 0) {
        const churnData = churnDataArray[0];

        // Alert on high churn rate using configurable threshold
        if (churnData.previousChurnRate !== undefined) {
          const percentageIncrease =
            ((churnData.churnRate - churnData.previousChurnRate) /
              churnData.previousChurnRate) *
            100;

          if (
            percentageIncrease > this.alertThresholds.CHURN_ALERT_PERCENTAGE
          ) {
            await this.alertService.createChurnRateAlert({
              period: churnData.period,
              churnRate: churnData.churnRate,
              previousRate: churnData.previousChurnRate,
              percentageIncrease,
            });
          }
        }
      }

      this.logger.log('Daily payment metrics calculation completed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error calculating daily metrics: ${errorMessage}`,
        errorStack,
      );
    }
  }

  // Run weekly on Mondays at 1 AM
  @Cron(CronExpression.EVERY_WEEK)
  async calculateWeeklyMetrics() {
    try {
      this.logger.log('Calculating weekly payment metrics');

      // Calculate MRR data
      await this.calculateMRR();

      // Additional weekly metrics here

      this.logger.log('Weekly payment metrics calculation completed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error calculating weekly metrics: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Get payment statistics for a given time period
   */
  async getPaymentStatistics(days: number = 1): Promise<{
    totalAttempted: number;
    totalSuccessful: number;
    totalFailed: number;
    totalRefunded: number;
    successRate: number;
    refundRate: number;
    averageAmount: number;
    currency: string;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all payments in the period
    const payments = await this.paymentRepository.find({
      where: {
        createdAt: MoreThan(startDate),
      },
    });

    // Calculate statistics
    // Categorize payments by status
    const successfulPayments = payments.filter(
      (p) => p.status === PaymentStatus.COMPLETED,
    );
    const failedPayments = payments.filter(
      (p) => p.status === PaymentStatus.FAILED,
    );
    // Fix the type issue by using explicit comparisons
    const refundedPayments = payments.filter(
      (p) =>
        p.status === PaymentStatus.REFUNDED ||
        p.status === PaymentStatus.PARTIALLY_REFUNDED,
    );

    // Calculate payment statistics
    const totalAttempted = payments.length;
    const totalSuccessful = successfulPayments.length;
    const totalFailed = failedPayments.length;
    const totalRefunded = refundedPayments.length;

    const successRate =
      totalAttempted > 0 ? (totalSuccessful / totalAttempted) * 100 : 0;
    const refundRate =
      totalSuccessful > 0 ? (totalRefunded / totalSuccessful) * 100 : 0;

    // Calculate average amount (using only successful payments)
    const totalAmount = successfulPayments.reduce(
      (sum, payment) => sum + (payment.amount ?? 0),
      0,
    );
    const averageAmount =
      totalSuccessful > 0 ? totalAmount / totalSuccessful : 0;

    // Handle currency safely
    const currency =
      successfulPayments.length > 0
        ? successfulPayments[0].currency ?? 'USD'
        : 'USD';

    return {
      totalAttempted,
      totalSuccessful,
      totalFailed,
      totalRefunded,
      successRate,
      refundRate,
      averageAmount,
      currency,
    };
  }

  /**
   * Calculate Monthly Recurring Revenue (MRR) metrics
   */
  async calculateMRR(): Promise<MRRData[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12); // Get 12 months of data

      const subscriptions = await this.subscriptionRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
          status: In([
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.PAST_DUE,
          ]),
        },
      });

      // Get canceled subscriptions in the date range
      const canceledSubscriptions = await this.subscriptionRepository.find({
        where: {
          canceledAt: Between(startDate, endDate),
          status: SubscriptionStatus.CANCELED, // Use enum instead of string
        },
      });

      // Group subscriptions by month
      interface SubscriptionGroup {
        [key: string]: Subscription[];
      }

      const subscriptionsByMonth: SubscriptionGroup = {};
      const canceledByMonth: SubscriptionGroup = {};

      // Initialize the months
      const months = this.getMonthsBetweenDates(startDate, endDate);
      months.forEach((monthKey) => {
        subscriptionsByMonth[monthKey] = [];
        canceledByMonth[monthKey] = [];
      });

      // Group active subscriptions by month of creation
      subscriptions.forEach((subscription) => {
        const createdAt = new Date(subscription.createdAt);
        const monthKey = this.getMonthKey(createdAt);

        if (subscriptionsByMonth[monthKey]) {
          subscriptionsByMonth[monthKey].push(subscription);
        }
      });

      // Group canceled subscriptions by month of cancellation
      canceledSubscriptions.forEach((subscription) => {
        if (subscription.canceledAt) {
          const canceledAt = new Date(subscription.canceledAt);
          const monthKey = this.getMonthKey(canceledAt);

          if (canceledByMonth[monthKey]) {
            canceledByMonth[monthKey].push(subscription);
          }
        }
      });

      // Calculate MRR data for each month
      const mrrData: MRRData[] = [];
      let previousMRR = 0;

      months.forEach((monthKey) => {
        // Calculate new MRR from new subscriptions
        const newSubscriptions = subscriptionsByMonth[monthKey] || [];
        const newMRR = newSubscriptions.reduce((sum, sub) => {
          // Use type assertion to handle the missing amount property
          return sum + ((sub as any).amount || 0);
        }, 0);

        // Calculate churn MRR from canceled subscriptions
        const canceledSubs = canceledByMonth[monthKey] || [];
        const churnMRR = canceledSubs.reduce((sum, sub) => {
          // Use type assertion to handle the missing amount property
          return sum + ((sub as any).amount || 0);
        }, 0);

        // Calculate net MRR change
        const netNewMRR = newMRR - churnMRR;

        // Calculate current month's MRR
        const currentMRR = previousMRR + netNewMRR;
        previousMRR = currentMRR;

        mrrData.push({
          date: monthKey,
          mrr: currentMRR,
          netNewMRR,
          expansionMRR: 0, // You'll need additional logic for expansion
          churnMRR,
        });
      });

      return mrrData;
    } catch (error: unknown) {
      // Proper error handling with type checking
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error calculating MRR data for date range: ${errorMessage}`,
        errorStack,
      );
      return []; // Return empty array in case of error
    }
  }

  /**
   * Get MRR data for a specific date range
   */
  async getMRRData(startDate?: Date, endDate?: Date): Promise<MRRDataDto[]> {
    try {
      // Use default dates if not provided
      const end = endDate || new Date();
      const start = startDate || new Date(end);
      start.setMonth(start.getMonth() - 12); // Default to 12 months before end date

      // Calculate MRR data for the specified date range
      const mrrData = await this.getMRRDataForDateRange(start, end);

      // Convert to DTOs
      return mrrData.map((data) => ({
        date: data.date,
        mrr: data.mrr,
        newMRR: data.netNewMRR, // Add the missing property
        netNewMRR: data.netNewMRR,
        expansionMRR: data.expansionMRR,
        churnMRR: data.churnMRR,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Error getting MRR data: ${errorMessage}`, errorStack);
      return [];
    }
  }

  /**
   * Get MRR data for a specific date range using Between operator
   */
  async getMRRDataForDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<MRRData[]> {
    try {
      const subscriptions = await this.subscriptionRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
          status: In([
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.PAST_DUE,
          ]),
        },
      });

      // Get canceled subscriptions in the date range
      const canceledSubscriptions = await this.subscriptionRepository.find({
        where: {
          canceledAt: Between(startDate, endDate),
          status: SubscriptionStatus.CANCELED, // Use enum instead of string
        },
      });

      // Group subscriptions by month
      interface SubscriptionGroup {
        [key: string]: Subscription[];
      }

      const subscriptionsByMonth: SubscriptionGroup = {};
      const canceledByMonth: SubscriptionGroup = {};

      // Initialize the months
      const months = this.getMonthsBetweenDates(startDate, endDate);
      months.forEach((monthKey) => {
        subscriptionsByMonth[monthKey] = [];
        canceledByMonth[monthKey] = [];
      });

      // Group active subscriptions by month of creation
      subscriptions.forEach((subscription) => {
        const createdAt = new Date(subscription.createdAt);
        const monthKey = this.getMonthKey(createdAt);

        if (subscriptionsByMonth[monthKey]) {
          subscriptionsByMonth[monthKey].push(subscription);
        }
      });

      // Group canceled subscriptions by month of cancellation
      canceledSubscriptions.forEach((subscription) => {
        if (subscription.canceledAt) {
          const canceledAt = new Date(subscription.canceledAt);
          const monthKey = this.getMonthKey(canceledAt);

          if (canceledByMonth[monthKey]) {
            canceledByMonth[monthKey].push(subscription);
          }
        }
      });

      // Calculate MRR data for each month
      const mrrData: MRRData[] = [];
      let previousMRR = 0;

      months.forEach((monthKey) => {
        // Calculate new MRR from new subscriptions
        const newSubscriptions = subscriptionsByMonth[monthKey] || [];
        const newMRR = newSubscriptions.reduce((sum, sub) => {
          // Use type assertion to handle the missing amount property
          return sum + ((sub as any).amount || 0);
        }, 0);

        // Calculate churn MRR from canceled subscriptions
        const canceledSubs = canceledByMonth[monthKey] || [];
        const churnMRR = canceledSubs.reduce((sum, sub) => {
          // Use type assertion to handle the missing amount property
          return sum + ((sub as any).amount || 0);
        }, 0);

        // Calculate net MRR change
        const netNewMRR = newMRR - churnMRR;

        // Calculate current month's MRR
        const currentMRR = previousMRR + netNewMRR;
        previousMRR = currentMRR;

        mrrData.push({
          date: monthKey,
          mrr: currentMRR,
          netNewMRR,
          expansionMRR: 0, // You'll need additional logic for expansion
          churnMRR,
        });
      });

      return mrrData;
    } catch (error: unknown) {
      // Proper error handling with type checking
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error calculating MRR data for date range: ${errorMessage}`,
        errorStack,
      );
      return []; // Return empty array in case of error
    }
  }

  /**
   * Helper method to get months between two dates
   */
  private getMonthsBetweenDates(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      months.push(this.getMonthKey(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }

  /**
   * Helper method to get month key in YYYY-MM format
   */
  private getMonthKey(date: Date): string {
    return date.toISOString().substring(0, 7); // YYYY-MM format
  }

  /**
   * Calculate churn rate
   */
  async calculateChurnRate(
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ): Promise<ChurnData[]> {
    try {
      // Get the base churn rate from subscription service
      const baseChurnRate = await this.subscriptionService.calculateChurnRate();

      // Get date for the current period
      const currentDate = new Date();
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;
      let currentPeriodStart: Date;

      // Set date ranges based on the period
      if (period === 'daily') {
        currentPeriodStart = new Date(currentDate);
        currentPeriodStart.setHours(0, 0, 0, 0);

        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);

        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setSeconds(previousPeriodEnd.getSeconds() - 1);
      } else if (period === 'weekly') {
        // Calculate start of this week (Sunday)
        currentPeriodStart = new Date(currentDate);
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        currentPeriodStart.setDate(currentPeriodStart.getDate() - dayOfWeek);
        currentPeriodStart.setHours(0, 0, 0, 0);

        // Previous week
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);

        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setSeconds(previousPeriodEnd.getSeconds() - 1);
      } else {
        // monthly (default)
        // Start of current month
        currentPeriodStart = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );

        // Previous month
        previousPeriodStart = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          1,
        );
        previousPeriodEnd = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          0,
          23,
          59,
          59,
        );
      }

      // Now calculate previous period churn rate for comparison
      const previousPeriodChurnRate = await this.calculateHistoricalChurnRate(
        previousPeriodStart,
        previousPeriodEnd,
      );

      // Format the dates for display
      const formattedDate =
        period === 'monthly'
          ? currentPeriodStart.toISOString().substring(0, 7) // YYYY-MM
          : currentPeriodStart.toISOString().split('T')[0]; // YYYY-MM-DD

      // Build the churn data object
      const churnData: ChurnData = {
        period,
        date: formattedDate,
        totalCustomers: 0, // This would come from a real count
        churnedCustomers: 0, // This would come from a real count
        churnRate: baseChurnRate,
        previousChurnRate: previousPeriodChurnRate,
      };

      return [churnData];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error calculating churn rate: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Calculate historical churn rate for a specific date range
   * @private
   */
  private async calculateHistoricalChurnRate(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      // Count subscriptions canceled within the date range
      const canceledSubscriptions = await this.subscriptionRepository.count({
        where: {
          canceledAt: Between(startDate, endDate),
          status: SubscriptionStatus.CANCELED,
        },
      });

      // Count subscriptions that were active at the start of the period
      const totalActiveStart = await this.subscriptionRepository.count({
        where: [
          {
            createdAt: LessThan(startDate),
            status: In([
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.PAST_DUE,
              SubscriptionStatus.TRIAL,
            ]),
          },
        ],
      });

      // Calculate churn rate
      return totalActiveStart > 0
        ? (canceledSubscriptions / totalActiveStart) * 100
        : 0;
    } catch (error) {
      this.logger.error(
        `Failed to calculate historical churn rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 0;
    }
  }

  /**
   * Get payment failure analytics by user
   */
  async getPaymentFailuresByUser(
    days: number = 30,
  ): Promise<PaymentFailureAnalytic[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const failedPayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.FAILED,
        createdAt: MoreThan(startDate),
      },
    });

    // Type the accumulator object
    interface FailuresByUserMap {
      [userId: string]: Payment[];
    }

    const failuresByUser = failedPayments.reduce<FailuresByUserMap>(
      (acc, payment) => {
        // Skip payments without userId
        if (payment.userId === undefined || payment.userId === null) {
          // Either skip completely, or collect under a 'unknown' key
          if (!acc['unknown']) {
            acc['unknown'] = [];
          }
          acc['unknown'].push(payment);
        } else {
          // For payments with userId, collect normally
          if (!acc[payment.userId]) {
            acc[payment.userId] = [];
          }
          acc[payment.userId].push(payment);
        }
        return acc;
      },
      {},
    );

    // Return typed analytics
    return Object.keys(failuresByUser).map(
      (userId): PaymentFailureAnalytic => ({
        userId,
        failedPayments: failuresByUser[userId].length,
        lastFailureDate: new Date(
          Math.max(...failuresByUser[userId].map((p) => p.createdAt.getTime())),
        ),
        errorCodes: failuresByUser[userId]
          .map((p) => (p as any).errorCode || 'unknown')
          .filter((v, i, a) => a.indexOf(v) === i && v !== 'unknown'), // Get unique error codes
      }),
    );
  }

  /**
   * Get a summary of recent payment activity
   */
  async getPaymentActivitySummary(days: number = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all payments in the period
    const payments = await this.paymentRepository.find({
      where: {
        createdAt: MoreThan(startDate),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    // Group by date (YYYY-MM-DD)
    interface PaymentsByDateMap {
      [date: string]: Payment[];
    }

    const paymentsByDate = payments.reduce<PaymentsByDateMap>(
      (acc, payment) => {
        const date = payment.createdAt.toISOString().split('T')[0];
        acc[date] = [...(acc[date] || []), payment];
        return acc;
      },
      {},
    );

    // Convert to array of daily summaries
    interface DailySummary {
      date: string;
      total: number;
      successful: number;
      failed: number;
      refunded: number;
      totalAmount: number;
      currency: string;
    }

    const dailySummaries = Object.keys(paymentsByDate).map(
      (date): DailySummary => {
        const dailyPayments = paymentsByDate[date];
        const successful = dailyPayments.filter(
          (p) => p.status === PaymentStatus.COMPLETED,
        ).length;
        const failed = dailyPayments.filter(
          (p) => p.status === PaymentStatus.FAILED,
        ).length;
        const refunded = dailyPayments.filter(
          (p) =>
            p.status === PaymentStatus.REFUNDED ||
            p.status === PaymentStatus.PARTIALLY_REFUNDED,
        ).length;

        // Calculate total amount (successful payments only)
        const completedPayments = dailyPayments.filter(
          (p) => p && p.status === PaymentStatus.COMPLETED,
        );
        const totalAmount = completedPayments.reduce(
          (sum, p) => sum + (p.amount ?? 0),
          0,
        );

        // Get currency (assuming all payments use the same currency)
        const currency = dailyPayments[0]?.currency || 'USD';

        return {
          date,
          total: dailyPayments.length,
          successful,
          failed,
          refunded,
          totalAmount,
          currency,
        };
      },
    );

    // Sort by date
    dailySummaries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      days,
      dailySummaries,
      totals: {
        payments: payments.length,
        successful: payments.filter((p) => p.status === PaymentStatus.COMPLETED)
          .length,
        failed: payments.filter((p) => p.status === PaymentStatus.FAILED)
          .length,
        refunded: payments.filter(
          (p) =>
            p.status === PaymentStatus.REFUNDED ||
            p.status === PaymentStatus.PARTIALLY_REFUNDED,
        ).length,
        amount: payments
          .filter((p) => p.status === PaymentStatus.COMPLETED)
          .reduce((sum, p) => sum + (p.amount ?? 0), 0), // Add nullish coalescing operator
      },
    };
  }
}
