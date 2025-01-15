import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';

@Injectable()
export class PaymentAnalyticsService {
  private readonly logger = new Logger(PaymentAnalyticsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async getRevenueMetrics(startDate: Date, endDate: Date) {
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
        (sum, payment) => sum + payment.amount,
        0,
      );
      const averageOrderValue = totalRevenue / payments.length;

      return {
        totalRevenue,
        averageOrderValue,
        transactionCount: payments.length,
        periodStart: startDate,
        periodEnd: endDate,
      };
    } catch (error) {
      this.logger.error(`Failed to get revenue metrics: ${error.message}`);
      throw error;
    }
  }

  async getSubscriptionMetrics() {
    try {
      const [activeSubscriptions, totalSubscriptions] = await Promise.all([
        this.subscriptionRepository.count({
          where: { status: SubscriptionStatus.ACTIVE },
        }),
        this.subscriptionRepository.count(),
      ]);

      const churnRate = await this.calculateChurnRate();
      const mrr = await this.calculateMRR();

      return {
        activeSubscriptions,
        totalSubscriptions,
        churnRate,
        monthlyRecurringRevenue: mrr,
      };
    } catch (error) {
      this.logger.error(`Failed to get subscription metrics: ${error.message}`);
      throw error;
    }
  }

  private async calculateChurnRate(): Promise<number> {
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

    return totalActiveStart > 0
      ? (canceledSubscriptions / totalActiveStart) * 100
      : 0;
  }

  private async calculateMRR(): Promise<number> {
    const activeSubscriptions = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['user'],
    });

    return activeSubscriptions.reduce((total, subscription) => {
      // You would need to implement logic here to calculate the monthly value
      // of each subscription based on your pricing structure
      return total + this.getSubscriptionMonthlyValue(subscription);
    }, 0);
  }

  private getSubscriptionMonthlyValue(subscription: Subscription): number {
    // Implement your pricing logic here
    // This is just a placeholder
    return 0;
  }
}
