import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stripe } from 'stripe';
import { ConfigService } from '@nestjs/config';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class SubscriptionService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-01-13',
    });
  }

  async createSubscription(
    user: User,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    try {
      // Ensure user has a Stripe customer ID
      const stripeCustomerId = await this.getOrCreateCustomer(user);

      // Create subscription in Stripe
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomerId,
        items: [{ price: createSubscriptionDto.priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      };

      if (createSubscriptionDto.trialDays) {
        subscriptionData.trial_period_days = createSubscriptionDto.trialDays;
      }

      if (createSubscriptionDto.couponCode) {
        subscriptionData.coupon = createSubscriptionDto.couponCode;
      }

      const stripeSubscription =
        await this.stripe.subscriptions.create(subscriptionData);

      // Create subscription record in database
      const subscription = this.subscriptionRepository.create({
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: createSubscriptionDto.priceId,
        stripeCustomerId,
        status: stripeSubscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000,
        ),
        user,
        metadata: {
          hasTrial: !!createSubscriptionDto.trialDays,
          couponApplied: !!createSubscriptionDto.couponCode,
        },
      });

      await this.subscriptionRepository.save(subscription);

      // Send confirmation email
      await this.emailService.sendSubscriptionConfirmation(user.email, {
        subscriptionId: subscription.id,
        trialDays: createSubscriptionDto.trialDays,
        endDate: subscription.currentPeriodEnd,
      });

      return subscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  async cancelSubscription(
    user: User,
    subscriptionId: string,
    cancelImmediately: boolean = false,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, user: { id: user.id } },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: !cancelImmediately,
          ...(cancelImmediately && { cancel_immediately: true }),
        },
      );

      subscription.cancelAtPeriodEnd = !cancelImmediately;
      subscription.canceledAt = new Date();
      if (cancelImmediately) {
        subscription.status = SubscriptionStatus.CANCELED;
      }

      await this.subscriptionRepository.save(subscription);

      // Send cancellation email
      await this.emailService.sendSubscriptionCancellation(user.email, {
        subscriptionId: subscription.id,
        endDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd,
      });

      return subscription;
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw error;
    }
  }

  private async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id,
      },
    });

    user.stripeCustomerId = customer.id;
    await this.userRepository.save(user);

    return customer.id;
  }
}
