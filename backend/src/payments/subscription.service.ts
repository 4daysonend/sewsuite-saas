import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import {
  Subscription,
  SubscriptionStatus
} from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

interface SubscriptionCancellationOptions {
  cancelImmediately?: boolean;
  reason?: string;
  sendEmail?: boolean;
}

interface PaymentSuccessData {
  amount: number;
  invoiceId: string;
  date: Date;
}

interface PaymentFailureData extends PaymentSuccessData {
  reason: string;
}

@Injectable()
export class SubscriptionService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }

  /**
   * Create a new subscription for a user
   * @param user User to create subscription for
   * @param createSubscriptionDto Subscription details
   * @returns Created subscription
   */
  async createSubscription(
    user: User,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    try {
      // Ensure user has a Stripe customer ID
      const stripeCustomerId = await this.getOrCreateCustomer(user);

      // Create subscription configuration
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomerId,
        items: [{ price: createSubscriptionDto.priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      };

      // Add trial if specified
      if (createSubscriptionDto.trialDays && createSubscriptionDto.trialDays > 0) {
        subscriptionData.trial_period_days = createSubscriptionDto.trialDays;
      }

      // Add coupon if specified
      if (createSubscriptionDto.couponCode) {
        subscriptionData.coupon = createSubscriptionDto.couponCode;
      }

      // Create subscription in Stripe
      const stripeSubscription = await this.stripe.subscriptions.create(subscriptionData);

      // Get price information
      let priceInfo = null;
      try {
        priceInfo = await this.stripe.prices.retrieve(createSubscriptionDto.priceId, {
          expand: ['product'],
        });
      } catch (error) {
        this.logger.warn(`Could not retrieve price information: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Create subscription record in database
      const subscription = this.subscriptionRepository.create({
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: createSubscriptionDto.priceId,
        stripeCustomerId,
        status: stripeSubscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        user,
        metadata: {
          hasTrial: !!createSubscriptionDto.trialDays,
          couponApplied: !!createSubscriptionDto.couponCode,
          priceData: priceInfo ? {
            currency: priceInfo.currency,
            unitAmount: priceInfo.unit_amount,
            recurring: priceInfo.recurring,
            productName: priceInfo.product && typeof priceInfo.product !== 'string' 
              ? priceInfo.product.name 
              : undefined,
          } : null,
          invoiceId: stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice !== 'string'
            ? stripeSubscription.latest_invoice.id
            : null,
        },
      });

      await this.subscriptionRepository.save(subscription);

      // Send confirmation email
      await this.sendSubscriptionConfirmationEmail(user, {
        subscriptionId: subscription.id,
        trialDays: createSubscriptionDto.trialDays,
        endDate: subscription.currentPeriodEnd,
        productName: priceInfo && typeof priceInfo.product !== 'string' 
          ? priceInfo.product.name 
          : 'subscription',
      });

      return subscription;
    } catch (error) {
      this.logger.error(
        `Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Payment processing error: ${error.message}`);
      }
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to process subscription');
    }
  }

  /**
   * Cancel a subscription
   * @param user User cancelling the subscription
   * @param subscriptionId Subscription ID to cancel
   * @param options Cancellation options
   * @returns Updated subscription
   */
  async cancelSubscription(
    user: User,
    subscriptionId: string,
    options: SubscriptionCancellationOptions = {}
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, user: { id: user.id } },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      const cancelImmediately = options.cancelImmediately ?? false;
      
      // Update subscription in Stripe
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: !cancelImmediately,
          ...(cancelImmediately ? { cancel_immediately: true } : {}),
          metadata: {
            cancelReason: options.reason || 'user_requested',
            cancelledAt: new Date().toISOString(),
          },
        },
      );

      // Update subscription in database
      subscription.cancelAtPeriodEnd = !cancelImmediately;
      subscription.canceledAt = new Date();
      
      if (cancelImmediately) {
        subscription.status = SubscriptionStatus.CANCELED;
      }

      subscription.metadata = {
        ...subscription.metadata,
        cancelReason: options.reason || 'user_requested',
        cancelledAt: new Date().toISOString(),
      };

      await this.subscriptionRepository.save(subscription);

      // Send cancellation email if requested
      if (options.sendEmail !== false) {
        await this.sendSubscriptionCancellationEmail(user, {
          subscriptionId: subscription.id,
          endDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd,
          reason: options.reason,
        });
      }

      return subscription;
    } catch (error) {
      this.logger.error(
        `Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Payment processing error: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Update subscription payment method
   * @param user User owning the subscription
   * @param subscriptionId Subscription ID to update
   * @param paymentMethodId New Stripe payment method ID
   * @returns Updated subscription
   */
  async updatePaymentMethod(
    user: User,
    subscriptionId: string,
    paymentMethodId: string,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, user: { id: user.id } },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: subscription.stripeCustomerId,
      });

      // Set as default payment method
      await this.stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update subscription payment method
      await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          default_payment_method: paymentMethodId,
        },
      );

      subscription.metadata = {
        ...subscription.metadata,
        lastPaymentMethodUpdate: new Date().toISOString(),
      };

      return this.subscriptionRepository.save(subscription);
    } catch (error) {
      this.logger.error(
        `Failed to update payment method: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Payment processing error: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Get user's active subscriptions
   * @param userId User ID
   * @returns Active subscriptions
   */
  async getUserActiveSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { 
        user: { id: userId },
        status: SubscriptionStatus.ACTIVE,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get all user's subscriptions including inactive ones
   * @param userId User ID
   * @returns All user subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { user: { id: userId } },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get subscription details
   * @param subscriptionId Subscription ID
   * @param userId Optional user ID for authorization
   * @returns Subscription with details
   */
  async getSubscription(
    subscriptionId: string,
    userId?: string,
  ): Promise<Subscription> {
    const queryOptions = {
      where: {
        id: subscriptionId,
        ...(userId ? { user: { id: userId } } : {}),
      },
      relations: ['user'],
    };

    const subscription = await this.subscriptionRepository.findOne(queryOptions);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      // Get latest data from Stripe
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          expand: ['latest_invoice', 'default_payment_method'],
        },
      );

      // Sync status if different
      if (subscription.status !== stripeSubscription.status) {
        subscription.status = stripeSubscription.status as SubscriptionStatus;
        await this.subscriptionRepository.save(subscription);
      }

      return subscription;
    } catch (error) {
      this.logger.warn(
        `Could not retrieve latest Stripe data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Return the database record even if Stripe retrieval fails
      return subscription;
    }
  }

  /**
   * Handle Stripe webhook for subscription events
   * @param event Stripe event
   */
  async handleSubscriptionWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      // Don't throw error so webhook request succeeds
    }
  }

  /**
   * Ensure user has a Stripe customer ID, creating one if needed
   * @param user User to get/create customer for
   * @returns Stripe customer ID
   */
  private async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.fullName || undefined,
        metadata: {
          userId: user.id,
        },
      });

      // Update user with new customer ID
      await this.usersService.update(user.id, {
        stripeCustomerId: customer.id,
      });

      return customer.id;
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new BadRequestException('Failed to create payment account');
    }
  }

  /**
   * Send subscription confirmation email
   * @param user User to send email to
   * @param data Subscription details
   */
  private async sendSubscriptionConfirmationEmail(
    user: User,
    data: {
      subscriptionId: string;
      trialDays?: number;
      endDate: Date;
      productName: string;
    }
  ): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: data.trialDays 
          ? `Your ${data.productName} Trial Has Started` 
          : `Your ${data.productName} Subscription Confirmation`,
        html: this.generateSubscriptionConfirmationHtml(user, data),
        text: this.generateSubscriptionConfirmationText(user, data),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send subscription confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Send subscription cancellation email
   * @param user User to send email to
   * @param data Cancellation details
   */
  private async sendSubscriptionCancellationEmail(
    user: User,
    data: {
      subscriptionId: string;
      endDate: Date;
      reason?: string;
    }
  ): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Your Subscription Has Been Cancelled',
        html: this.generateCancellationEmailHtml(user, data),
        text: this.generateCancellationEmailText(user, data),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Handle subscription created webhook
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      // Check if subscription exists in our database
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (existingSubscription) {
        // Already processed during creation
        return;
      }

      // Find user by customer ID
      const user = await this.usersService.findByStripeCustomerId(subscription.customer as string);
      if (!user) {
        this.logger.warn(`No user found for customer: ${subscription.customer}`);
        return;
      }

      // Create subscription record
      const newSubscription = this.subscriptionRepository.create({
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || '',
        stripeCustomerId: subscription.customer as string,
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        user,
        metadata: {
          createdByWebhook: true,
          stripeEvent: 'customer.subscription.created',
        },
      });

      await this.subscriptionRepository.save(newSubscription);
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription created: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle subscription updated webhook
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscription.id },
        relations: ['user'],
      });

      if (!existingSubscription) {
        this.logger.warn(`Subscription not found: ${subscription.id}`);
        return;
      }

      // Update subscription data
      existingSubscription.status = subscription.status as SubscriptionStatus;
      existingSubscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
      existingSubscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      
      if (subscription.canceled_at) {
        existingSubscription.canceledAt = new Date(subscription.canceled_at * 1000);
      }
      
      existingSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      
      existingSubscription.metadata = {
        ...existingSubscription.metadata,
        lastUpdated: new Date().toISOString(),
        stripeStatus: subscription.status,
      };

      await this.subscriptionRepository.save(existingSubscription);
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription updated: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle subscription deleted webhook
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscription.id },
        relations: ['user'],
      });

      if (!existingSubscription) {
        this.logger.warn(`Subscription not found: ${subscription.id}`);
        return;
      }

      // Update subscription status
      existingSubscription.status = SubscriptionStatus.CANCELED;
      existingSubscription.canceledAt = new Date();
      existingSubscription.metadata = {
        ...existingSubscription.metadata,
        deletedAt: new Date().toISOString(),
        deletedByStripe: true,
      };

      await this.subscriptionRepository.save(existingSubscription);
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription deleted: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle invoice payment succeeded webhook
   * @param invoice Stripe invoice object
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) {
      return; // Not subscription-related
    }

    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription.id;

    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscriptionId },
        relations: ['user'],
      });

      if (!subscription) {
        this.logger.warn(`Subscription not found: ${subscriptionId}`);
        return;
      }

      // Update subscription with new period end if available
      if (invoice.period_end) {
        subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
      }

      subscription.metadata = {
        ...subscription.metadata,
        lastInvoiceId: invoice.id,
        lastPaymentDate: new Date().toISOString(),
        lastPaymentAmount: invoice.amount_paid / 100,
      };

      await this.subscriptionRepository.save(subscription);

      // Send payment confirmation if user available
      if (subscription.user && subscription.user.email) {
        await this.emailService.sendEmail({
          to: subscription.user.email,
          subject: 'Your Subscription Payment Was Successful',
          html: this.generatePaymentSuccessHtml(subscription.user, {
            amount: invoice.amount_paid / 100,
            invoiceId: invoice.id,
            date: new Date(),
          }),
          text: this.generatePaymentSuccessText(subscription.user, {
            amount: invoice.amount_paid / 100,
            invoiceId: invoice.id,
            date: new Date(),
          }),
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle invoice payment succeeded: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle invoice payment failed webhook
   * @param invoice Stripe invoice object
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) {
      return; // Not subscription-related
    }

    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription.id;

    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscriptionId },
        relations: ['user'],
      });

      if (!subscription) {
        this.logger.warn(`Subscription not found: ${subscriptionId}`);
        return;
      }

      // Update subscription metadata with payment failure
      subscription.metadata = {
        ...subscription.metadata,
        lastFailedInvoiceId: invoice.id,
        lastPaymentFailure: new Date().toISOString(),
        paymentFailureReason: invoice.last_payment_error?.message || 'Unknown payment error',
      };

      await this.subscriptionRepository.save(subscription);

      // Send payment failure notification if user available
      if (subscription.user && subscription.user.email) {
        await this.emailService.sendEmail({
          to: subscription.user.email,
          subject: 'Your Subscription Payment Failed',
          html: this.generatePaymentFailureHtml(subscription.user, {
            amount: invoice.amount_due / 100,
            invoiceId: invoice.id,
            date: new Date(),
            reason: invoice.last_payment_error?.message || 'Your payment could not be processed',
          }),
          text: this.generatePaymentFailureText(subscription.user, {
            amount: invoice.amount_due / 100,
            invoiceId: invoice.id,
            date: new Date(),
            reason: invoice.last_payment_error?.message || 'Your payment could not be processed',
          }),
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle invoice payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate HTML email for subscription confirmation
   * @param user User receiving email
   * @param data Subscription data
   * @returns HTML email
   */
  private generateSubscriptionConfirmationHtml(
    user: User,
    data: {
      subscriptionId: string;
      trialDays?: number;
      endDate: Date;
      productName: string;
    }
  ): string {
    const isTrial = !!data.trialDays;
    const title = isTrial 
      ? `Your ${data.productName} Trial Has Started` 
      : `Your ${data.productName} Subscription`;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a4a4a;">${title}</h2>
        <p>Hello ${user.firstName || user.email},</p>
        
        ${isTrial 
          ? `<p>Your ${data.trialDays}-day free trial of ${data.productName} has started.</p>` 
          : `<p>Thank you for subscribing to ${data.productName}!</p>`
        }
        
        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
          ${isTrial 
            ? `<p><strong>Trial End Date:</strong> ${data.endDate.toLocaleDateString()}</p>` 
            : `<p><strong>Next Billing Date:</strong> ${data.endDate.toLocaleDateString()}</p>`
          }
        </div>
        
        ${isTrial 
          ? `<p>After your trial ends, your payment method will be charged unless you cancel before the trial period ends.</p>` 
          : `<p>You can manage your subscription from your account dashboard at any time.</p>`
        }
        
        <p>If you have any questions or need assistance, please contact our support team.</p>
        <p>Thank you for choosing our service!</p>
      </div>
    `;
  }

  /**
   * Generate text email for subscription confirmation
   * @param user User receiving email
   * @param data Subscription data
   * @returns Text email
   */
  private generateSubscriptionConfirmationText(
    user: User,
    data: {
      subscriptionId: string;
      trialDays?: number;
      endDate: Date;
      productName: string;
    }
  ): string {
    const isTrial = !!data.trialDays;
    const title = isTrial 
      ? `Your ${data.productName} Trial Has Started` 
      : `Your ${data.productName} Subscription`;
    
    return `
${title}

Hello ${user.firstName || user.email},

${isTrial 
  ? `Your ${data.trialDays}-day free trial of ${data.productName} has started.` 
  : `Thank you for subscribing to ${data.productName}!`
}

Subscription ID: ${data.subscriptionId}
${isTrial 
  ? `Trial End Date: ${data.endDate.toLocaleDateString()}` 
  : `Next Billing Date: ${data.endDate.toLocaleDateString()}`
}

${isTrial 
  ? `After your trial ends, your payment method will be charged unless you cancel before the trial period ends.` 
  : `You can manage your subscription from your account dashboard at any time.`
}

If you have any questions or need assistance, please contact our support team.

Thank you for choosing our service!
    `;
  }

  /**
   * Generate HTML email for subscription cancellation
   * @param user User receiving email
   * @param data Cancellation data
   * @returns HTML email
   */
  private generateCancellationEmailHtml(
    user: User,
    data: {
      subscriptionId: string;
      endDate: Date;
      reason?: string;
    }
  ): string {
    const isImmediately = data.endDate <= new Date();
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a4a4a;">Subscription Cancelled</h2>
        <p>Hello ${user.firstName || user.email},</p>
        
        <p>Your subscription has been cancelled as requested.</p>
        
        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
          ${isImmediately 
            ? `<p><strong>Cancelled:</strong> Effective immediately</p>` 
            : `<p><strong>Access Until:</strong> ${data.endDate.toLocaleDateString()}</p>`
          }
          ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
        </div>
        
        ${isImmediately 
          ? `<p>Your access has been terminated and you will no longer be billed.</p>` 
          : `<p>You will continue to have access until the end of your current billing period, after which you will no longer be charged.</p>`
        }
        
        <p>We're sorry to see you go. If you change your mind, you can resubscribe from your account dashboard at any time.</p>
        <p>If you have any feedback about your experience, we'd love to hear from you.</p>
      </div>
    `;
  }

  /**
   * Generate text email for subscription cancellation
   * @param user User receiving email
   * @param data Cancellation data
   * @returns Text email
   */
  private generateCancellationEmailText(
    user: User,
    data: {
      subscriptionId: string;
      endDate: Date;
      reason?: string;
    }
  ): string {
    const isImmediately = data.endDate <= new Date();
    
    return `
Subscription Cancelled

Hello ${user.firstName || user.email},

Your subscription has been cancelled as requested.

Subscription ID: ${data.subscriptionId}
${isImmediately 
  ? `Cancelled: Effective immediately` 
  : `Access Until: ${data.endDate.toLocaleDateString()}`
}
${data.reason ? `Reason: ${data.reason}` : ''}

${isImmediately 
  ? `Your access has been terminated and you will no longer be billed.` 
  : `You will continue to have access until the end of your current billing period, after which you will no longer be charged.`
}

We're sorry to see you go. If you change your mind, you can resubscribe from your account dashboard at any time.

If you have any feedback about your experience, we'd love to hear from you.
    `;
  }

  /**
   * Generate HTML email for payment success
   * @param user User receiving email
   * @param data Payment data
   * @returns HTML
   * /
    private generatePaymentSuccessHtml(
    user: User,
    data: PaymentSuccessData
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a4a4a;">Payment Successful</h2>
        <p>Hello ${user.firstName || user.email},</p>
        
        <p>Your subscription payment has been successfully processed.</p>
        
        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Amount:</strong> $${data.amount.toFixed(2)}</p>
          <p><strong>Invoice ID:</strong> ${data.invoiceId}</p>
          <p><strong>Date:</strong> ${data.date.toLocaleDateString()}</p>
        </div>
        
        <p>You can view your invoice details and payment history in your account dashboard.</p>
        <p>Thank you for your continued subscription.</p>
      </div>
    `;
  }

  /**
   * Generate text email for payment success
   * @param user User receiving email
   * @param data Payment data
   * @returns Text email
   */
  private generatePaymentSuccessText(
    user: User,
    data: PaymentSuccessData
  ): string {
    return `
Payment Successful

Hello ${user.firstName || user.email},

Your subscription payment has been successfully processed.

Amount: $${data.amount.toFixed(2)}
Invoice ID: ${data.invoiceId}
Date: ${data.date.toLocaleDateString()}

You can view your invoice details and payment history in your account dashboard.

Thank you for your continued subscription.
    `;
  }

  /**
   * Generate HTML email for payment failure
   * @param user User receiving email
   * @param data Payment failure data
   * @returns HTML email
   */
  private generatePaymentFailureHtml(
    user: User,
    data: PaymentFailureData
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e53e3e;">Payment Failed</h2>
        <p>Hello ${user.firstName || user.email},</p>
        
        <p>We were unable to process your subscription payment.</p>
        
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fee2e2;">
          <p><strong>Amount Due:</strong> $${data.amount.toFixed(2)}</p>
          <p><strong>Invoice ID:</strong> ${data.invoiceId}</p>
          <p><strong>Date:</strong> ${data.date.toLocaleDateString()}</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        
        <p>Please update your payment information in your account dashboard to avoid any interruption to your service.</p>
        <p>If you need assistance, please contact our support team.</p>
      </div>
    `;
  }

  /**
   * Generate text email for payment failure
   * @param user User receiving email
   * @param data Payment failure data
   * @returns Text email
   */
  private generatePaymentFailureText(
    user: User,
    data: PaymentFailureData
  ): string {
    return `
Payment Failed

Hello ${user.firstName || user.email},

We were unable to process your subscription payment.

Amount Due: $${data.amount.toFixed(2)}
Invoice ID: ${data.invoiceId}
Date: ${data.date.toLocaleDateString()}
Reason: ${data.reason}

Please update your payment information in your account dashboard to avoid any interruption to your service.

If you need assistance, please contact our support team.
    `;
  }
}