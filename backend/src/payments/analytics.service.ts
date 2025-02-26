import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';

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

interface SubscriptionRevenue {
  priceId: string;
  count: number;
  revenue: number;
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
  async getRevenueMetrics(startDate: Date, endDate: Date): Promise<RevenueMetrics> {
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
      const averageOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

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
          where: { status: SubscriptionStatus.ACTIVE },
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
        .where('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
        .groupBy('subscription.stripePriceId')
        .getRawMany<{ priceId: string; count: string }>();

      // Get price information from metadata
      const subscriptions = await this.subscriptionRepository.find({
        where: { status: SubscriptionStatus.ACTIVE },
        select: ['stripePriceId', 'metadata'],
      });

      // Create a price map for quick lookups
      const priceMap = new Map<string, number>();
      for (const sub of subscriptions) {
        if (sub.metadata?.priceData?.unitAmount) {
          priceMap.set(sub.stripePriceId, sub.metadata.priceData.unitAmount / 100);
        }
      }

      // Calculate total MRR
      return subscriptionRevenue.reduce((total, item) => {
        const count = parseInt(item.count, 10);
        const price = priceMap.get(item.priceId) || 0;
        return total + (count * price);
      }, 0);
    } catch (error) {
      this.logger.error(
        `Failed to calculate MRR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 0;
    }
  }

  /**
   * Calculate churn rate over the last 30 days
   * @returns Churn rate as a percentage
   */
  private async calculateChurnRate(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [canceledSubscriptions, totalActiveStart] = await Promise.all([
        this.subscriptionRepository.count({
          where: {
            canceledAt: Between(thirtyDaysAgo, new Date()),
            status: SubscriptionStatus.CANCELED,
          },
        }),
        this.subscriptionRepository.count({
          where: {
            createdAt: LessThan(thirtyDaysAgo),
            status: SubscriptionStatus.ACTIVE,
          },
        }),
      ]);

      return totalActiveStart > 0 ? (canceledSubscriptions / totalActiveStart) * 100 : 0;
    } catch (error) {
      this.logger.error(
        `Failed to calculate churn rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        .select('payment.metadata->\'paymentMethod\' as method')
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
  async getDailyTransactionTrends(days = 30): Promise
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
  async getSubscriptionGrowthMetrics(months = 12): Promise
    Array<{
      month: string;
      newSubscriptions: number;
      canceledSubscriptions: number;
      netGrowth: number;
      totalActive: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      // Get new subscriptions by month
      const newSubscriptions = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select('DATE_TRUNC(\'month\', subscription.createdAt)', 'month')
        .addSelect('COUNT(*)', 'count')
        .where('subscription.createdAt >= :startDate', { startDate })
        .groupBy('month')
        .orderBy('month', 'ASC')
        .getRawMany<{ month: string; count: string }>();

      // Get canceled subscriptions by month
      const canceledSubscriptions = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select('DATE_TRUNC(\'month\', subscription.canceledAt)', 'month')
        .addSelect('COUNT(*)', 'count')
        .where('subscription.canceledAt >= :startDate', { startDate })
        .andWhere('subscription.status = :status', {
          status: SubscriptionStatus.CANCELED,
        })
        .groupBy('month')
        .orderBy('month', 'ASC')
        .getRawMany<{ month: string; count: string }>();

      // Combine data and calculate metrics
      const monthlyData = new Map
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
        monthlyData.set(item.month, {
          newSubscriptions: parseInt(item.count, 10),
          canceledSubscriptions: 0,
          netGrowth: parseInt(item.count, 10),
          totalActive: 0, // Will calculate later
        });
      }

      // Add canceled subscriptions
      for (const item of canceledSubscriptions) {
        if (monthlyData.has(item.month)) {
          const current = monthlyData.get(item.month)!;
          const canceled = parseInt(item.count, 10);
          monthlyData.set(item.month, {
            ...current,
            canceledSubscriptions: canceled,
            netGrowth: current.newSubscriptions - canceled,
          });
        } else {
          monthlyData.set(item.month, {
            newSubscriptions: 0,
            canceledSubscriptions: parseInt(item.count, 10),
            netGrowth: -parseInt(item.count, 10),
            totalActive: 0,
          });
        }
      }

      // Calculate cumulative active subscriptions
      let runningTotal = 0;
      const sortedMonths = [...monthlyData.keys()].sort();
      
      for (const month of sortedMonths) {
        const data = monthlyData.get(month)!;
        runningTotal += data.netGrowth;
        monthlyData.set(month, {
          ...data,
          totalActive: Math.max(0, runningTotal), // Ensure non-negative
        });
      }

      // Convert map to sorted array
      return sortedMonths.map((month) => ({
        month,
        ...monthlyData.get(month)!,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get subscription growth metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }
}