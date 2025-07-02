// src/payments/services/subscription.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, FindOptionsWhere, In } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {}

  /**
   * Map Stripe subscription status to our status enum
   */
  mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE;
      case 'incomplete_expired':
        return SubscriptionStatus.EXPIRED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'trialing':
        return SubscriptionStatus.TRIAL;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.UNKNOWN;
    }
  }

  /**
   * Find subscriptions by status
   */
  async findByStatus(status: SubscriptionStatus): Promise<Subscription[]> {
    const where: FindOptionsWhere<Subscription> = { status };

    return this.subscriptionRepository.find({
      where,
      relations: ['user'],
    });
  }

  /**
   * Calculate churn rate
   */
  async calculateChurnRate(): Promise<number> {
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
          } as FindOptionsWhere<Subscription>,
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
            } as FindOptionsWhere<Subscription>,
          ],
        }),
      ]);

      // Calculate churn rate
      const churnRate =
        totalActiveStart > 0
          ? (canceledSubscriptions / totalActiveStart) * 100
          : 0;

      return churnRate;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to calculate churn rate: ${errorMessage}`);
      return 0;
    }
  }
}
