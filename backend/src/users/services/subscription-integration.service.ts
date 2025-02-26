import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Subscription } from '../../payments/entities/subscription.entity';

@Injectable()
export class SubscriptionIntegrationService {
  private readonly logger = new Logger(SubscriptionIntegrationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async handleSubscriptionChange(
    userId: string,
    subscriptionId: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['subscriptions'],
    });

    if (!user) {
      this.logger.warn(
        `User ${userId} not found when handling subscription change`,
      );
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      this.logger.warn(`Subscription ${subscriptionId} not found`);
      return;
    }

    // Update user features based on subscription
    await this.updateUserFeatures(user, subscription);

    // Update storage quota based on subscription
    await this.updateStorageQuota(user, subscription);

    // Handle subscription-specific updates
    await this.handleSubscriptionSpecificUpdates(user, subscription);
  }

  private async updateUserFeatures(
    user: User,
    subscription: Subscription,
  ): Promise<void> {
    const features = this.getSubscriptionFeatures(subscription);

    user.preferences = {
      ...user.preferences,
      features: {
        ...user.preferences.features,
        ...features,
      },
    };

    await this.userRepository.save(user);
  }

  private async updateStorageQuota(
    user: User,
    subscription: Subscription,
  ): Promise<void> {
    // Update storage quota based on subscription tier
    const quotaUpdates = this.getSubscriptionQuota(subscription);
    await this.updateUserQuota(user, quotaUpdates);
  }

  private async handleSubscriptionSpecificUpdates(
    user: User,
    subscription: Subscription,
  ): Promise<void> {
    switch (subscription.stripePriceId) {
      case 'price_professional':
        await this.handleProfessionalSubscription(user);
        break;
      case 'price_business':
        await this.handleBusinessSubscription(user);
        break;
      case 'price_enterprise':
        await this.handleEnterpriseSubscription(user);
        break;
    }
  }

  private getSubscriptionFeatures(
    subscription: Subscription,
  ): Record<string, boolean> {
    // Define features based on subscription tier
    const baseFeatures = {
      orderManagement: true,
      clientPortal: true,
      fileStorage: true,
      measurements: true,
    };

    switch (subscription.stripePriceId) {
      case 'price_professional':
        return {
          ...baseFeatures,
          advancedAnalytics: true,
          customBranding: true,
        };
      case 'price_business':
        return {
          ...baseFeatures,
          advancedAnalytics: true,
          customBranding: true,
          multiUser: true,
          api: true,
        };
      case 'price_enterprise':
        return {
          ...baseFeatures,
          advancedAnalytics: true,
          customBranding: true,
          multiUser: true,
          api: true,
          dedicatedSupport: true,
          customIntegrations: true,
        };
      default:
        return baseFeatures;
    }
  }

  private getSubscriptionQuota(subscription: Subscription): {
    totalSpace: number;
  } {
    // Define storage quotas based on subscription tier
    switch (subscription.stripePriceId) {
      case 'price_professional':
        return { totalSpace: 10737418240 }; // 10GB
      case 'price_business':
        return { totalSpace: 107374182400 }; // 100GB
      case 'price_enterprise':
        return { totalSpace: 1099511627776 }; // 1TB
      default:
        return { totalSpace: 1073741824 }; // 1GB
    }
  }

  private async updateUserQuota(
    user: User,
    quotaUpdates: { totalSpace: number },
  ): Promise<void> {
    // Implementation would update StorageQuota entity
    this.logger.debug(
      `Updating quota for user ${user.id} to ${quotaUpdates.totalSpace} bytes`,
    );
  }

  private async handleProfessionalSubscription(user: User): Promise<void> {
    // Handle professional tier specific setup
    this.logger.debug(`Setting up professional features for user ${user.id}`);
  }

  private async handleBusinessSubscription(user: User): Promise<void> {
    // Handle business tier specific setup
    this.logger.debug(`Setting up business features for user ${user.id}`);
  }

  private async handleEnterpriseSubscription(user: User): Promise<void> {
    // Handle enterprise tier specific setup
    this.logger.debug(`Setting up enterprise features for user ${user.id}`);
  }
}
