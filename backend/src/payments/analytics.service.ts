import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In, FindOptionsWhere } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from './enums/subscription-status.enum';

interface RevenueMetrics {
  totalRevenue: number;
  averageOrderValue: number;
  transactionCount: number;
  periodStart: Date;
  periodEnd: Date;
}

interface SubscriptionMetrics {
  activeSubscriptions: number;
  totalSubscriptions: number;
  churnRate: number;
  monthlyRecurringRevenue: number;
}

interface MonthCountResult {
  month: string | null;
  count: string | null;
}

@Injectable()
export class PaymentAnalyticsService {
  private readonly logger = new Logger(PaymentAnalyticsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  /**
   * Get revenue metrics for a specific period
   * @param startDate Beginning of period
   * @param endDate End of period
   * @returns RevenueMetrics object with analytics
   */
  async getRevenueMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueMetrics> {
    try {
      const payments = await this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .andWhere('payment.status = :status', {
          status: PaymentStatus.COMPLETED,
        })
        .getMany();

      const totalRevenue = payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const transactionCount = payments.length;
      const averageOrderValue =
        transactionCount > 0 ? totalRevenue / transactionCount : 0;

      return {
        totalRevenue,
        averageOrderValue,
        transactionCount,
        periodStart: startDate,
        periodEnd: endDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get revenue metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get subscription metrics including active subscriptions, churn rate, and MRR
   * @returns SubscriptionMetrics object with analytics
   */
  async getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
    try {
      const [activeSubscriptions, totalSubscriptions] = await Promise.all([
        this.subscriptionRepository.count({
          where: {
            status: SubscriptionStatus.ACTIVE,
          } as FindOptionsWhere<Subscription>, // Type assertion
        }),
        this.subscriptionRepository.count(),
      ]);

      const churnRate = await this.calculateChurnRate();
      const monthlyRecurringRevenue = await this.calculateMRR();

      return {
        activeSubscriptions,
        totalSubscriptions,
        churnRate,
        monthlyRecurringRevenue,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get subscription metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Calculate monthly recurring revenue based on active subscriptions
   * @returns Total MRR value
   */
  private async calculateMRR(): Promise<number> {
    try {
      // Get all active subscriptions with price data
      const subscriptionRevenue = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select('subscription.stripePriceId', 'priceId')
        .addSelect('COUNT(*)', 'count')
        .where('subscription.status = :status', {
          status: SubscriptionStatus.ACTIVE,
        })
        .groupBy('subscription.stripePriceId')
        .getRawMany<{ priceId: string; count: string }>();

      // Get price information from metadata
      const subscriptions = await this.subscriptionRepository.find({
        where: { status: SubscriptionStatus.ACTIVE },
        select: ['stripePriceId', 'metadata'], // Changed to stripePriceId
      });

      // Create a price map for quick lookups
      const priceMap = new Map<string, number>();
      for (const sub of subscriptions) {
        if (sub.metadata?.priceData?.unitAmount && sub.stripePriceId) {
          // Changed to stripePriceId
          priceMap.set(
            sub.stripePriceId, // Changed to stripePriceId
            sub.metadata.priceData.unitAmount / 100,
          );
        }
      }

      // Calculate total MRR
      return subscriptionRevenue.reduce((total, item) => {
        const price = priceMap.get(item.priceId) || 0;
        const count = parseInt(item.count, 10);
        return total + price * count;
      }, 0);
    } catch (error) {
      this.logger.error(
        `Failed to calculate MRR: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0; // Return 0 on error
    }
  }

  /**
   * Calculate the churn rate over the last 30 days
   * @returns Churn rate as a percentage
   */
  private async calculateChurnRate(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get counts of canceled and active subscriptions
      const [canceledSubscriptions, totalActiveStart] = await Promise.all([
        // Count subscriptions canceled in the last 30 days
        this.subscriptionRepository.count({
          where: {
            canceledAt: Between(thirtyDaysAgo, new Date()),
            status: SubscriptionStatus.CANCELED,
          },
        }),
        // Count subscriptions that were active at the start of the period
        this.subscriptionRepository.count({
          where: [
            {
              createdAt: LessThan(thirtyDaysAgo),
              status: In([
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.TRIAL,
              ]),
            },
          ],
        }),
      ]);

      // Calculate churn rate
      const churnRate =
        totalActiveStart > 0
          ? (canceledSubscriptions / totalActiveStart) * 100
          : 0;

      this.logger.debug(
        `Churn rate calculation: ${canceledSubscriptions} canceled out of ${totalActiveStart} active = ${churnRate.toFixed(2)}%`,
      );

      return churnRate;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to calculate churn rate: ${errorMessage}`,
        errorStack,
      );
      return 0;
    }
  }

  /**
   * Get revenue breakdown by payment method
   * @param startDate Beginning of period
   * @param endDate End of period
   * @returns Payment method distribution
   */
  async getRevenueByPaymentMethod(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, number>> {
    try {
      const paymentMethodData = await this.paymentRepository
        .createQueryBuilder('payment')
        .select("payment.metadata->'paymentMethod' as method")
        .addSelect('SUM(payment.amount)', 'amount')
        .where('payment.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .andWhere('payment.status = :status', {
          status: PaymentStatus.COMPLETED,
        })
        .groupBy('method')
        .getRawMany<{ method: string; amount: string }>();

      // Convert to record with numeric values
      return paymentMethodData.reduce(
        (result, item) => ({
          ...result,
          [item.method || 'unknown']: parseFloat(item.amount) || 0,
        }),
        {} as Record<string, number>,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get revenue by payment method: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {};
    }
  }

  /**
   * Get daily transaction trends
   * @param days Number of days to analyze
   * @returns Daily transaction data
   */
  async getDailyTransactionTrends(days = 30): Promise<
    Array<{
      date: string;
      count: number;
      volume: number;
      successRate: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const dailyStats = await this.paymentRepository
        .createQueryBuilder('payment')
        .select('DATE(payment.createdAt)', 'date')
        .addSelect('COUNT(*)', 'total')
        .addSelect(
          'SUM(CASE WHEN payment.status = :completedStatus THEN 1 ELSE 0 END)',
          'successful',
        )
        .addSelect('SUM(payment.amount)', 'volume')
        .where('payment.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .setParameter('completedStatus', PaymentStatus.COMPLETED)
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany<{
          date: string;
          total: string;
          successful: string;
          volume: string;
        }>();

      return dailyStats.map((day) => {
        const total = parseInt(day.total, 10);
        const successful = parseInt(day.successful, 10);
        return {
          date: day.date,
          count: total,
          volume: parseFloat(day.volume) || 0,
          successRate: total > 0 ? (successful / total) * 100 : 0,
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to get daily transaction trends: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Get subscription growth metrics
   * @param months Number of months to analyze
   * @returns Monthly subscription growth data
   */
  async getSubscriptionAnalytics(months: number): Promise<{
    newSubscriptions: { month: string; count: string }[];
    canceledSubscriptions: { month: string; count: string }[];
    netGrowth: number;
    totalActive: number;
  }> {
    try {
      // Declare startDate and initialize it
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      // Ensure subscriptionRepository is defined
      if (!this.subscriptionRepository) {
        throw new Error('subscriptionRepository is not initialized.');
      }

      // Fetch new subscriptions
      const newSubscriptions = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select("DATE_TRUNC('month', subscription.createdAt) AS month")
        .addSelect('COUNT(*) AS count')
        .where('subscription.createdAt >= :startDate', { startDate })
        .groupBy('month')
        .orderBy('month', 'ASC')
        .getRawMany<MonthCountResult>();

      // Fetch canceled subscriptions
      const canceledSubscriptions = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select("DATE_TRUNC('month', subscription.canceledAt) AS month")
        .addSelect('COUNT(*) AS count')
        .where('subscription.canceledAt >= :startDate', { startDate })
        .andWhere('subscription.canceledAt IS NOT NULL') // Make sure this column is not null
        .groupBy('month')
        .orderBy('month', 'ASC')
        .getRawMany<MonthCountResult>();

      // Initialize monthlyData map
      const monthlyData = new Map<
        string,
        {
          newSubscriptions: number;
          canceledSubscriptions: number;
          netGrowth: number;
          totalActive: number;
        }
      >();

      // Initialize with new subscriptions
      for (const item of newSubscriptions) {
        // Check if month exists before using it
        if (item.month) {
          monthlyData.set(item.month, {
            newSubscriptions: parseInt(item.count || '0', 10),
            canceledSubscriptions: 0,
            netGrowth: parseInt(item.count || '0', 10),
            totalActive: 0, // Will calculate later
          });
        }
      }

      // Add canceled subscriptions
      for (const item of canceledSubscriptions) {
        // Check if month exists before using it
        if (item.month) {
          if (monthlyData.has(item.month)) {
            const current = monthlyData.get(item.month);
            // Add null check
            if (current) {
              const canceled = parseInt(item.count || '0', 10);
              monthlyData.set(item.month, {
                ...current,
                canceledSubscriptions: canceled,
                netGrowth: current.newSubscriptions - canceled,
              });
            }
          } else {
            monthlyData.set(item.month, {
              newSubscriptions: 0,
              canceledSubscriptions: parseInt(item.count || '0', 10),
              netGrowth: -parseInt(item.count || '0', 10),
              totalActive: 0,
            });
          }
        }
      }

      // Calculate cumulative active subscriptions
      let runningTotal = 0;
      const sortedMonths = [...monthlyData.keys()].sort();

      for (const month of sortedMonths) {
        const data = monthlyData.get(month);
        // Add null check
        if (data) {
          runningTotal += data.netGrowth;
          monthlyData.set(month, {
            ...data,
            totalActive: Math.max(0, runningTotal), // Ensure non-negative
          });
        }
      }

      // Return the data with type safety
      return {
        newSubscriptions: newSubscriptions.map((item) => ({
          month: item.month ?? '',
          count: item.count ?? '0',
        })),
        canceledSubscriptions: canceledSubscriptions.map((item) => ({
          month: item.month ?? '',
          count: item.count ?? '0',
        })),
        netGrowth: runningTotal,
        totalActive: runningTotal,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get subscription growth metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        newSubscriptions: [],
        canceledSubscriptions: [],
        netGrowth: 0,
        totalActive: 0,
      };
    }
  }
}
