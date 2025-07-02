import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThan,
  LessThan,
  DeepPartial,
  FindOptionsWhere,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '../../users/entities/user.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { CreateCheckoutSessionDto } from '../dto/create-checkout-session.dto';
import { QueryTransactionsDto } from '../dto/query-transactions.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto'; // Import RefundPaymentDto
import { AlertService } from '../../common/services/alert.service';
import { AuditService } from '../../common/services/audit.service';
import {
  AlertSeverity,
  AlertCategory,
} from '../../common/enums/alert-severity.enum'; // Import AlertSeverity and AlertCategory enums
import { isStripeError, handleStripeError } from '../utils/stripe-error.utils';
import { SubscriptionService } from '../services/subscription.service'; // Import SubscriptionService
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly subscriptionService: SubscriptionService, // Add this
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly eventEmitter: EventEmitter2,
    private readonly alertService: AlertService,
    private readonly auditService: AuditService,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET is not defined in the configuration',
      );
      throw new Error('Missing required configuration: STRIPE_WEBHOOK_SECRET');
    }

    this.webhookSecret = webhookSecret;
  }

  /**
   * Validate a webhook request from Stripe
   */
  async validateWebhook(
    rawBody: Buffer,
    signature: string,
    webhookSecret?: string,
  ): Promise<Stripe.Event> {
    try {
      const secretToUse = webhookSecret || this.webhookSecret;

      if (!secretToUse) {
        throw new Error('No webhook secret provided');
      }

      // Pass only the two parameters that constructEvent expects
      return this.stripeService.constructEvent(rawBody, signature);
    } catch (error) {
      // Use log instead of error if you have logger method issues
      this.logger.log(
        `[ERROR] Failed to validate webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;

        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error processing webhook event ${event.type}: ${errorMessage}`,
        errorStack,
      );

      await this.alertService.createAlert({
        severity: AlertSeverity.ERROR, // Changed 'level' to 'severity'
        category: AlertCategory.SYSTEM, // Changed 'source' to 'category'
        title: 'Webhook Processing Error',
        message: `Failed to process webhook event: ${event.type}`,
        details: {
          eventType: event.type,
          eventId: event.id,
          error: errorMessage,
        },
        source: 'payments_webhook',
        requiresAction: true,
      });
    }
  }

  /**
   * Handle checkout session completed webhook event
   */
  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    try {
      // Extract metadata from session
      const userId = session.metadata?.userId;

      if (!userId) {
        this.logger.warn(
          `No user ID found in checkout session metadata: ${session.id}`,
        );
        return;
      }

      // Extract paymentIntentId from the session
      let paymentIntentId: string | undefined;
      if (
        typeof session.payment_intent === 'string' &&
        session.payment_intent.trim() !== ''
      ) {
        paymentIntentId = session.payment_intent;
      } else if (
        session.payment_intent &&
        typeof session.payment_intent === 'object'
      ) {
        paymentIntentId = session.payment_intent.id;
      }

      // Create payment record with proper type handling
      const paymentData: DeepPartial<Payment> = {
        userId,
        stripePaymentIntentId: paymentIntentId,
        // Only include this if your Payment entity has this field
        stripeCustomerId:
          typeof session.customer === 'string' ? session.customer : undefined,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency || 'USD',
        status: PaymentStatus.COMPLETED,
        paymentMethodId: 'card',
        metadata: session.metadata ?? {}, // Use nullish coalescing
      };

      const payment = this.paymentRepository.create(paymentData);
      await this.paymentRepository.save(payment);

      this.logger.log(
        `Created payment record for checkout session ${session.id}, user ${userId}`,
      );

      // If this is a subscription checkout
      if (session.subscription) {
        this.logger.log(
          `Checkout session ${session.id} includes subscription ${session.subscription}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling checkout session completed: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Handle invoice payment succeeded webhook event
   */
  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    try {
      // This is typically for subscription payments
      if (invoice.subscription) {
        // Find the subscription in our database
        const subscription = await this.subscriptionRepository.findOne({
          where: { stripeSubscriptionId: invoice.subscription },
          relations: ['user'], // Include this relation
        });

        if (subscription) {
          // Create payment record
          const paymentData: DeepPartial<Payment> = {
            userId: subscription.userId,
            stripePaymentIntentId: invoice.payment_intent,
            stripeCustomerId: invoice.customer,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid / 100, // Convert from cents
            currency: invoice.currency,
            status: PaymentStatus.COMPLETED,
            paymentMethodId: invoice.payment_method_details?.type || 'card',
            metadata: invoice.metadata ?? {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
            },
          };

          const payment = this.paymentRepository.create(paymentData);
          await this.paymentRepository.save(payment);

          this.logger.log(
            `Created payment record for invoice ${invoice.id}, subscription ${invoice.subscription}`,
          );

          // Update subscription dates
          if (invoice.lines?.data?.[0]) {
            const periodStart = invoice.lines.data[0].period.start;
            const periodEnd = invoice.lines.data[0].period.end;

            if (periodStart && periodEnd) {
              subscription.currentPeriodStart = new Date(periodStart * 1000);
              subscription.currentPeriodEnd = new Date(periodEnd * 1000);
              subscription.updatedAt = new Date();
              await this.subscriptionRepository.save(subscription);
            }
          }

          // Emit event
          this.eventEmitter.emit('invoice.payment.succeeded', {
            invoice,
            payment,
            subscription,
          });
        } else {
          this.logger.warn(
            `Subscription ${invoice.subscription} not found for invoice ${invoice.id}`,
          );
        }
      } else {
        this.logger.log(
          `Invoice payment succeeded but not associated with subscription: ${invoice.id}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling invoice payment succeeded: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Handle invoice payment failed webhook event
   */
  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    try {
      if (invoice.subscription) {
        // Find the subscription in our database
        const subscription = await this.subscriptionRepository.findOne({
          where: { stripeSubscriptionId: invoice.subscription },
          relations: ['user'],
        });

        if (subscription) {
          // Update subscription status to reflect failed payment
          if (subscription.status !== SubscriptionStatus.PAST_DUE) {
            subscription.status = SubscriptionStatus.PAST_DUE;
            subscription.updatedAt = new Date();
            await this.subscriptionRepository.save(subscription);

            this.logger.log(
              `Updated subscription ${subscription.id} status to PAST_DUE due to failed invoice ${invoice.id}`,
            );
          }

          // Create an alert
          await this.alertService.createAlert({
            severity: AlertSeverity.WARNING,
            category: AlertCategory.PAYMENT,
            title: 'Invoice Payment Failed',
            message: `Failed payment for subscription ${subscription.id}`,
            details: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              amount: invoice.amount_due / 100,
              currency: invoice.currency,
            },
            source: 'payments',
            requiresAction: true,
          });

          // Emit event
          this.eventEmitter.emit('invoice.payment.failed', {
            invoice,
            subscription,
          });

          // Optionally notify the user
          if (subscription.user?.email) {
            try {
              // Example (replace with your actual notification logic)
              this.eventEmitter.emit('email.invoice.payment.failed', {
                email: subscription.user.email,
                userId: subscription.userId,
                subscription,
                invoice: {
                  id: invoice.id,
                  number: invoice.number,
                  amount: invoice.amount_due / 100,
                  currency: invoice.currency,
                  nextAttempt: invoice.next_payment_attempt
                    ? new Date(invoice.next_payment_attempt * 1000)
                    : null,
                },
              });
            } catch (emailError: unknown) {
              const errorMessage =
                emailError instanceof Error
                  ? emailError.message
                  : 'Unknown error';
              this.logger.error(
                `Failed to send payment failure email: ${errorMessage}`,
              );
            }
          }
        } else {
          this.logger.warn(
            `Subscription ${invoice.subscription} not found for failed invoice ${invoice.id}`,
          );
        }
      } else {
        this.logger.log(
          `Invoice payment failed but not associated with subscription: ${invoice.id}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling invoice payment failed: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Get or create a Stripe customer ID for a user
   */
  async getStripeCustomerId(userId: string, email?: string): Promise<string> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      if (user.stripeCustomerId) {
        return user.stripeCustomerId;
      }

      const customerEmail = email || user.email;

      const customer = await this.stripeService.createCustomer({
        email: customerEmail,
        metadata: { userId },
        name:
          user.fullName ||
          `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      });

      user.stripeCustomerId = customer.id;
      await this.userRepository.save(user);

      return customer.id;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error getting/creating Stripe customer ID: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(
    checkoutDto: CreateCheckoutSessionDto,
    options: {
      successUrl: string;
      cancelUrl: string;
      metadata?: Record<string, any>;
    },
  ): Promise<Stripe.Checkout.Session> {
    // Validate required fields
    if (!checkoutDto.userId) {
      throw new BadRequestException('User ID is required for checkout');
    }

    try {
      // Create the session params with proper typing
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: checkoutDto.priceId,
            quantity: 1,
          },
        ],
        mode: checkoutDto.mode as Stripe.Checkout.SessionCreateParams.Mode,
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        metadata: {
          userId: checkoutDto.userId,
          ...(options.metadata ?? {}),
        },
      };

      // Add customer details if available
      if (checkoutDto.customerId) {
        sessionParams.customer = checkoutDto.customerId;
      } else if (checkoutDto.customerEmail) {
        sessionParams.customer_email = checkoutDto.customerEmail;
      }

      const session =
        await this.stripeService.createCheckoutSession(sessionParams);

      this.logger.log(
        `Created checkout session ${session.id} for user ${checkoutDto.userId}`,
      );

      return session;
    } catch (error: unknown) {
      // Choose one approach - either use the utility function or handle manually

      // Approach 1: Handle errors manually
      if (isStripeError(error)) {
        if (error.type === 'StripeCardError') {
          // Do something specific for card errors
          this.logger.warn(`Card error during checkout: ${error.message}`);
          throw new BadRequestException(`Payment card error: ${error.message}`);
        }

        // Handle other specific Stripe error types as needed
        if (error.type === 'StripeInvalidRequestError') {
          throw new BadRequestException(`Invalid request: ${error.message}`);
        }
      }

      // For non-Stripe errors or unhandled Stripe errors, log and re-throw
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating checkout session: ${errorMessage}`);

      throw error instanceof Error
        ? error
        : new InternalServerErrorException('Error creating checkout session');

      // Approach 2 (alternative): Just use the utility function
      // return handleStripeError(error, 'PaymentsService'); // This already throws
    }
  }

  /**
   * Create a billing portal session for a Stripe customer
   * @param customerId Stripe customer ID
   * @param returnUrl URL to redirect to after leaving the portal (optional)
   * @returns Stripe billing portal session
   */
  async createBillingPortalSession(
    customerId: string,
    returnUrl?: string,
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      // Default return URL if not provided
      const defaultReturnUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';

      // Create the billing portal session
      const session = await this.stripeService.createPortalSession({
        customer: customerId,
        return_url: returnUrl || `${defaultReturnUrl}/account/billing`,
      });

      this.logger.log(
        `Created billing portal session for customer ${customerId}`,
      );

      return session;
    } catch (error: unknown) {
      // Use the utility function
      handleStripeError(error, 'PaymentsService.createBillingPortalSession');
    }
  }

  /**
   * Example of using the exception
   */
  async someMethod(): Promise<any> {
    try {
      // Your code
    } catch (error: unknown) {
      // Type check the error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Error description: ${errorMessage}`, errorStack);

      // Then use these variables
      throw new BadRequestException(`Error: ${errorMessage}`);
    }
  }

  /**
   * Find payments by user ID
   */
  async findPaymentsByUser(userId: string): Promise<Payment[]> {
    const where: FindOptionsWhere<Payment> = { userId };
    return this.paymentRepository.find({ where });
  }

  /**
   * Find payments in a date range
   */
  async findPaymentsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find payments after a certain date
   */
  async findPaymentsAfterDate(date: Date): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        createdAt: MoreThan(date),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find payments before a certain date
   */
  async findPaymentsBeforeDate(date: Date): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        createdAt: LessThan(date),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find completed payments by user ID
   */
  async findCompletedPaymentsByUser(userId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        userId,
        status: PaymentStatus.COMPLETED,
      },
    });
  }

  /**
   * Find failed payments by user ID
   */
  async findFailedPaymentsByUser(userId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        userId,
        status: PaymentStatus.FAILED,
      },
    });
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(): Promise<{
    totalRevenue: number;
    totalPayments: number;
    successRate: number;
    refundRate: number;
    paymentsByStatus: Record<PaymentStatus, number>;
  }> {
    try {
      // Get the total revenue from successful payments
      const revenueResult = await this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
        .getRawOne();

      const totalRevenue = Number(revenueResult?.total || 0);

      // Get counts by status
      const paymentsByStatus: Record<PaymentStatus, number> = {} as any;

      // Initialize all statuses with 0
      Object.values(PaymentStatus).forEach((status) => {
        paymentsByStatus[status] = 0;
      });

      // Get actual counts
      const statusCounts = await this.paymentRepository
        .createQueryBuilder('payment')
        .select('payment.status', 'status')
        .addSelect('COUNT(payment.id)', 'count')
        .groupBy('payment.status')
        .getRawMany();

      statusCounts.forEach((item) => {
        // Ensure item.status is a valid PaymentStatus enum value
        if (
          Object.values(PaymentStatus).includes(item.status as PaymentStatus)
        ) {
          paymentsByStatus[item.status as PaymentStatus] = Number(item.count);
        }
      });

      // Calculate totals and rates
      const totalPayments = Object.values(paymentsByStatus).reduce(
        (sum, count) => sum + count,
        0,
      );
      const successRate =
        totalPayments > 0
          ? (paymentsByStatus[PaymentStatus.COMPLETED] / totalPayments) * 100
          : 0;
      const refundRate =
        paymentsByStatus[PaymentStatus.COMPLETED] > 0
          ? (paymentsByStatus[PaymentStatus.REFUNDED] /
              paymentsByStatus[PaymentStatus.COMPLETED]) *
            100
          : 0;

      return {
        totalRevenue,
        totalPayments,
        successRate,
        refundRate,
        paymentsByStatus,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error getting payment statistics: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Error retrieving payment statistics',
      );
    }
  }

  /**
   * Get payment status counts
   */
  async getPaymentStatusCounts(): Promise<Record<PaymentStatus, number>> {
    // Initialize counts for all known statuses
    const counts: Record<PaymentStatus, number> = Object.values(
      PaymentStatus,
    ).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<PaymentStatus, number>,
    );

    // Get all payments
    const payments = await this.paymentRepository.find();

    // Count by status, safely handling the types
    for (const payment of payments) {
      const status = payment.status;

      // Check if status is a valid PaymentStatus value
      if (Object.values(PaymentStatus).includes(status as any)) {
        const typedStatus = status as PaymentStatus;
        counts[typedStatus]++;
      } else {
        this.logger.warn(`Unknown payment status encountered: ${status}`);
      }
    }

    return counts;
  }

  /**
   * Find active subscriptions
   */
  async findActiveSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find canceled subscriptions
   */
  async findCanceledSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.CANCELED,
      },
      relations: ['user'],
      order: {
        canceledAt: 'DESC',
      },
    });
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStatistics(): Promise<any> {
    const activeCount = await this.subscriptionRepository.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    const canceledCount = await this.subscriptionRepository.count({
      where: { status: SubscriptionStatus.CANCELED },
    });

    const pastDueCount = await this.subscriptionRepository.count({
      where: { status: SubscriptionStatus.PAST_DUE },
    });

    const unpaidCount = await this.subscriptionRepository.count({
      where: { status: SubscriptionStatus.UNPAID },
    });

    return {
      active: activeCount,
      canceled: canceledCount,
      pastDue: pastDueCount,
      unpaid: unpaidCount,
      total: activeCount + canceledCount + pastDueCount + unpaidCount,
    };
  }

  /**
   * Get all subscriptions with filtering and pagination
   * @param page Page number (starting from 1)
   * @param limit Number of items per page
   * @param filters Optional filters for status and userId
   * @returns Paginated list of subscriptions with total count
   */
  async getAllSubscriptions(
    page = 1,
    limit = 10,
    filters: { status?: SubscriptionStatus; userId?: string } = {},
  ): Promise<{ data: Subscription[]; total: number }> {
    try {
      // Calculate pagination
      const skip = (page - 1) * limit;

      // Build where conditions
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      // Query with pagination
      const [data, total] = await this.subscriptionRepository.findAndCount({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
        relations: ['user'], // Include user information
      });

      this.logger.log(
        `Retrieved ${data.length} subscriptions (total: ${total})`,
      );

      return { data, total };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving subscriptions: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Error retrieving subscription data',
      );
    }
  }

  /**
   * Get subscription details by ID
   * @param id Subscription ID
   * @returns Subscription details with related user data
   * @throws NotFoundException if the subscription doesn't exist
   */
  async getSubscriptionById(id: string): Promise<Subscription> {
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { id },
        relations: ['user'], // Include user data
      });

      if (!subscription) {
        this.logger.warn(`Subscription with ID ${id} not found`);
        throw new NotFoundException(`Subscription with ID ${id} not found`);
      }

      // Optionally, fetch additional details from Stripe
      if (subscription.stripeSubscriptionId) {
        try {
          const stripeSubscription =
            await this.stripeService.retrieveSubscription(
              subscription.stripeSubscriptionId,
            );

          // Attach Stripe data (if your entity supports this)
          subscription.stripeDetails = stripeSubscription;
        } catch (stripeError: unknown) {
          const errorMessage =
            stripeError instanceof Error
              ? stripeError.message
              : 'Unknown error';
          const errorStack =
            stripeError instanceof Error ? stripeError.stack : undefined;

          this.logger.warn(
            `Could not retrieve Stripe data for subscription ${id}: ${errorMessage}`,
            errorStack,
          );
          // Continue processing - don't fail the entire request if Stripe data can't be fetched
        }
      }

      this.logger.log(`Retrieved subscription details for ID: ${id}`);
      return subscription;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw NotFoundException
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving subscription: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Error retrieving subscription details',
      );
    }
  }

  /**
   * Get a subscription with user access validation
   * @param subscriptionId Subscription ID
   * @param userId User ID requesting the subscription
   * @returns The subscription if the user has access to it
   * @throws UnauthorizedException if the user doesn't have access
   * @throws NotFoundException if the subscription doesn't exist
   */
  async getSubscription(
    subscriptionId: string,
    userId: string,
  ): Promise<Subscription> {
    try {
      // Find the subscription with user relation
      const subscription = await this.subscriptionRepository.findOne({
        where: { id: subscriptionId },
        relations: ['user'],
      });

      if (!subscription) {
        this.logger.warn(`Subscription ${subscriptionId} not found`);
        throw new NotFoundException(`Subscription not found`);
      }

      // Check if the subscription belongs to the user
      if (subscription.userId !== userId) {
        this.logger.warn(
          `User ${userId} attempted to access subscription ${subscriptionId} belonging to user ${subscription.userId}`,
        );
        throw new UnauthorizedException(
          `You don't have permission to access this subscription`,
        );
      }

      // Optionally enhance with Stripe data
      if (subscription.stripeSubscriptionId) {
        try {
          const stripeSubscription =
            await this.stripeService.retrieveSubscription(
              subscription.stripeSubscriptionId,
            );

          // Add Stripe data to the response
          subscription.stripeDetails = stripeSubscription;
        } catch (stripeError: unknown) {
          const errorMessage =
            stripeError instanceof Error
              ? stripeError.message
              : 'Unknown error';
          const errorStack =
            stripeError instanceof Error ? stripeError.stack : undefined;

          this.logger.warn(
            `Could not retrieve Stripe data for subscription ${subscriptionId}: ${errorMessage}`,
            errorStack,
          );
          // Don't fail the request if Stripe data can't be retrieved
        }
      }

      return subscription;
    } catch (error: unknown) {
      // Re-throw NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving subscription: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Error retrieving subscription details',
      );
    }
  }

  /**
   * Cancel a subscription
   * @param id Subscription ID to cancel
   * @param adminId ID of admin performing the cancellation
   * @param options Cancellation options
   * @returns Updated subscription
   */
  async cancelSubscription(
    id: string,
    adminId: string,
    options: {
      immediately?: boolean;
      reason?: string;
      sendEmail?: boolean;
    } = {},
  ): Promise<Subscription> {
    try {
      // Find the subscription
      const subscription = await this.subscriptionRepository.findOne({
        where: { id },
        relations: ['user'], // Include user for notifications
      });

      if (!subscription) {
        throw new NotFoundException(`Subscription with ID ${id} not found`);
      }

      // Check if already canceled
      if (subscription.status === SubscriptionStatus.CANCELED) {
        throw new BadRequestException('Subscription is already canceled');
      }

      // Cancel the subscription in Stripe
      if (!subscription.stripeSubscriptionId) {
        throw new BadRequestException('No Stripe subscription ID found');
      }

      await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        options.immediately || false,
      );

      // Update status in our database
      subscription.status = options.immediately
        ? SubscriptionStatus.CANCELED
        : SubscriptionStatus.PENDING_CANCELLATION;
      subscription.cancelAtPeriodEnd = !options.immediately;
      subscription.canceledAt = new Date();
      subscription.cancelReason = options.reason || 'Canceled by administrator';
      subscription.updatedAt = new Date();

      await this.subscriptionRepository.save(subscription);

      this.logger.log(
        `Admin ${adminId} canceled subscription ${id} for user ${subscription.userId} ` +
          `(${options.immediately ? 'immediately' : 'at period end'})`,
      );

      // Create audit log
      await this.auditService.logAction({
        userId: adminId,
        action: 'admin.subscription.cancel',
        details: {
          subscriptionId: id,
          userId: subscription.userId,
          immediately: options.immediately,
          reason: options.reason,
        },
      });

      // Emit event
      this.eventEmitter.emit('subscription.canceled', {
        subscription,
        canceledBy: adminId,
        canceledByAdmin: true,
        immediately: options.immediately,
        reason: options.reason,
      });

      // Optionally send email notification
      if (options.sendEmail && subscription.user?.email) {
        // This would connect to your email service
        // You might have a NotificationService or similar
        try {
          // Example (replace with your actual notification logic)
          this.eventEmitter.emit('email.subscription.canceled', {
            email: subscription.user.email,
            userId: subscription.userId,
            subscription,
            canceledByAdmin: true,
            cancelReason: options.reason,
          });
        } catch (emailError: unknown) {
          const errorMessage =
            emailError instanceof Error ? emailError.message : 'Unknown error';
          const errorStack =
            emailError instanceof Error ? emailError.stack : undefined;

          this.logger.error(
            `Failed to send cancellation email: ${errorMessage}`,
            errorStack,
          );
          // Don't fail the whole process if email sending fails
        }
      }

      return subscription;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error canceling subscription: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException('Error canceling subscription');
    }
  }

  /**
   * Handle payment intent succeeded
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: any,
  ): Promise<void> {
    // Find the payment in our database
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      // Update the payment status
      payment.status = PaymentStatus.COMPLETED;
      payment.updatedAt = new Date();
      await this.paymentRepository.save(payment);

      // Emit an event
      this.eventEmitter.emit('payment.completed', payment);
    }
  }

  /**
   * Handle payment intent failed webhook event
   */
  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    try {
      // Find the payment in our database
      const payment = await this.paymentRepository.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
      });

      if (payment) {
        // Update the payment status
        payment.status = PaymentStatus.FAILED;
        payment.errorCode =
          paymentIntent.last_payment_error?.code || 'unknown_error';
        payment.errorMessage =
          paymentIntent.last_payment_error?.message ||
          'Payment processing failed';
        payment.updatedAt = new Date();
        await this.paymentRepository.save(payment);

        // Emit an event
        this.eventEmitter.emit('payment.failed', payment);

        // Log the failure
        this.logger.warn(
          `Payment failed for intent ${paymentIntent.id}: ${payment.errorMessage}`,
        );

        // Create an alert for failed payment
        await this.alertService.createAlert({
          severity: AlertSeverity.WARNING,
          category: AlertCategory.PAYMENT,
          title: 'Payment Failed',
          message: `Payment processing failed: ${payment.errorMessage}`,
          details: {
            paymentId: payment.id,
            userId: payment.userId,
            amount: payment.amount,
            errorCode: payment.errorCode,
          },
          source: 'payments',
          requiresAction: false,
        });
      } else {
        this.logger.warn(
          `Payment not found for failed intent: ${paymentIntent.id}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling payment intent failed: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Handle subscription created webhook event
   */
  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    try {
      // Get the user ID from the customer ID
      const userId = await this.getUserIdFromCustomer(subscription.customer);

      if (!userId) {
        this.logger.warn(
          `Cannot find user for subscription ${subscription.id} with customer ${subscription.customer}`,
        );
        return;
      }

      // Create a new subscription record
      const newSubscription = this.subscriptionRepository.create({
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        status: this.subscriptionService.mapStripeSubscriptionStatus(
          subscription.status,
        ),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata ?? {},
      });

      await this.subscriptionRepository.save(newSubscription);

      this.logger.log(
        `Created subscription record for ${subscription.id}, user ${userId}`,
      );

      // Emit an event
      this.eventEmitter.emit('subscription.created', newSubscription);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling subscription created: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Handle subscription updated webhook event
   */
  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    try {
      // Find the subscription in our database
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!existingSubscription) {
        this.logger.warn(
          `Subscription ${subscription.id} not found in database`,
        );
        return;
      }

      // Update the subscription
      existingSubscription.status =
        this.subscriptionService.mapStripeSubscriptionStatus(
          subscription.status,
        );
      existingSubscription.currentPeriodStart = new Date(
        subscription.current_period_start * 1000,
      );
      existingSubscription.currentPeriodEnd = new Date(
        subscription.current_period_end * 1000,
      );
      existingSubscription.cancelAtPeriodEnd =
        subscription.cancel_at_period_end;

      if (subscription.canceled_at) {
        existingSubscription.canceledAt = new Date(
          subscription.canceled_at * 1000,
        );
      }

      existingSubscription.updatedAt = new Date();

      await this.subscriptionRepository.save(existingSubscription);

      this.logger.log(`Updated subscription ${subscription.id}`);

      // Emit an event
      this.eventEmitter.emit('subscription.updated', existingSubscription);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling subscription updated: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Handle subscription deleted webhook event
   */
  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    try {
      // Find the subscription in our database
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!existingSubscription) {
        this.logger.warn(
          `Subscription ${subscription.id} not found in database`,
        );
        return;
      }

      // Update the subscription
      existingSubscription.status = SubscriptionStatus.CANCELED;
      existingSubscription.canceledAt = new Date(
        subscription.canceled_at * 1000,
      );
      existingSubscription.updatedAt = new Date();

      await this.subscriptionRepository.save(existingSubscription);

      this.logger.log(`Marked subscription ${subscription.id} as canceled`);

      // Emit an event
      this.eventEmitter.emit('subscription.canceled', existingSubscription);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error handling subscription deleted: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Get user ID from Stripe customer ID
   */
  private async getUserIdFromCustomer(
    customerId: string,
  ): Promise<string | null> {
    try {
      // First try to find in our database
      const user = await this.userRepository.findOne({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        return user.id;
      }

      // If not found, check Stripe customer metadata
      const customer = await this.stripeService.getCustomer(customerId);

      if (customer?.metadata?.userId) {
        return customer.metadata.userId;
      }

      return null;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error getting user ID from customer: ${errorMessage}`,
        errorStack,
      );
      return null;
    }
  }

  /**
   * Query transactions with filtering and pagination
   */
  async queryTransactions(
    queryDto: QueryTransactionsDto,
  ): Promise<{ data: Payment[]; total: number }> {
    try {
      // Extract query parameters
      const {
        userId,
        status,
        minAmount,
        maxAmount,
        startDate,
        endDate,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = queryDto;

      // Build the where conditions
      const where: FindOptionsWhere<Payment> = {};

      // Add filters
      if (userId) {
        where.userId = userId;
      }

      // Helper function to map external status strings to enum values
      function mapStatusToEnum(status: string): PaymentStatus | undefined {
        switch (status.toLowerCase()) {
          case 'succeeded':
            return PaymentStatus.COMPLETED;
          case 'pending':
            return PaymentStatus.PENDING;
          case 'failed':
            return PaymentStatus.FAILED;
          case 'refunded':
            return PaymentStatus.REFUNDED;
          default:
            return undefined;
        }
      }

      // Use it in your query
      if (status) {
        const enumStatus = mapStatusToEnum(status);
        if (enumStatus) {
          where.status = enumStatus;
        } else {
          throw new BadRequestException(`Invalid payment status: ${status}`);
        }
      }

      // Add amount range filters
      if (minAmount !== undefined) {
        where.amount = MoreThanOrEqual(minAmount);
      }

      if (maxAmount !== undefined) {
        // If minAmount is also set, use Between
        if (minAmount !== undefined) {
          where.amount = Between(minAmount, maxAmount);
        } else {
          where.amount = LessThanOrEqual(maxAmount);
        }
      }

      // Add date range filters
      if (startDate || endDate) {
        if (startDate && endDate) {
          // Parse dates if they're not already Date objects
          const startDateObj = new Date(String(startDate));
          const endDateObj = new Date(String(endDate));

          // Set end date to end of day for inclusive range
          endDateObj.setHours(23, 59, 59, 999);

          where.createdAt = Between(startDateObj, endDateObj);
        } else if (startDate) {
          const startDateObj = new Date(String(startDate));
          where.createdAt = MoreThanOrEqual(startDateObj);
        } else if (endDate) {
          const endDateObj = new Date(String(endDate));
          // Set end date to end of day for inclusive range
          endDateObj.setHours(23, 59, 59, 999);
          where.createdAt = LessThanOrEqual(endDateObj);
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute the query with pagination
      const [data, total] = await this.paymentRepository.findAndCount({
        where,
        order: { [sortBy]: sortOrder },
        skip,
        take: limit,
      });

      return { data, total };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error querying transactions: ${errorMessage}`,
        errorStack,
      );

      // Re-throw BadRequestException
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Error querying transactions');
    }
  }

  /**
   * Issue a refund for a payment
   */
  async createRefund(
    paymentId: string,
    adminId: string,
    refundDto: RefundPaymentDto,
  ): Promise<{
    success: boolean;
    refundId: string;
    payment: Payment;
    amount: number;
  }> {
    try {
      // Find the payment to refund
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      // Validate payment status
      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          `Cannot refund payment with status: ${payment.status}`,
        );
      }

      // Check if already refunded
      if (payment.refunded) {
        throw new BadRequestException('This payment has already been refunded');
      }

      // Check if payment has a valid amount
      if (payment.amount === undefined || payment.amount === null) {
        throw new BadRequestException(
          'Cannot refund payment with no amount information',
        );
      }

      // Determine refund amount
      const refundAmount =
        refundDto.amount !== undefined ? refundDto.amount : payment.amount;

      // Validate refund amount
      if (refundAmount <= 0) {
        throw new BadRequestException(
          'Refund amount must be greater than zero',
        );
      }

      if (refundAmount > payment.amount) {
        throw new BadRequestException(
          'Refund amount cannot exceed the original payment amount',
        );
      }

      // Create the refund in Stripe
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Convert to cents for Stripe
        reason:
          (refundDto.reason as Stripe.RefundCreateParams.Reason) ||
          'requested_by_customer',
        metadata: {
          issuedByAdmin: adminId,
          originalPaymentId: paymentId,
          reason: refundDto.reason ?? null, // Convert undefined to null
          notes: refundDto.notes ?? null,
        },
      };

      const refund = await this.stripeService.createRefund(refundParams);

      // Update the payment record
      payment.refunded = true;
      payment.refundedAmount = refundAmount;
      payment.refundedAt = new Date();
      payment.refundReason = refundDto.reason;
      payment.refundId = refund.id;
      payment.updatedAt = new Date();

      await this.paymentRepository.save(payment);

      this.logger.log(
        `Admin ${adminId} refunded payment ${paymentId} for ${refundAmount}: ${
          refundDto.reason || 'No reason provided'
        }`,
      );

      // Emit payment.refunded event
      this.eventEmitter.emit('payment.refunded', {
        payment,
        refundAmount,
        adminId,
        reason: refundDto.reason,
      });

      return {
        success: true,
        refundId: refund.id,
        payment,
        amount: refundAmount,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Error processing refund: ${errorMessage}`, errorStack);

      // Re-throw NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to process refund: ${errorMessage}`,
      );
    }
  }

  /**
   * Get all payments with pagination and filtering
   * @param page Page number, starting from 1
   * @param limit Number of items per page
   * @param filters Optional filters for status, userId, date range, and amount range
   * @returns Paginated payments with total count
   */
  async getAllPayments(
    page = 1,
    limit = 10,
    filters: {
      status?: PaymentStatus;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      minAmount?: number;
      maxAmount?: number;
    } = {},
  ): Promise<{ data: Payment[]; total: number }> {
    try {
      // Calculate pagination parameters
      const skip = (page - 1) * limit;

      // Build where conditions
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.startDate) {
        where.createdAt = where.createdAt || {};
        where.createdAt = { ...where.createdAt, gte: filters.startDate };
      }

      if (filters.endDate) {
        where.createdAt = where.createdAt || {};
        where.createdAt = { ...where.createdAt, lte: filters.endDate };
      }

      if (filters.minAmount) {
        where.amount = where.amount || {};
        where.amount = { ...where.amount, gte: filters.minAmount };
      }

      if (filters.maxAmount) {
        where.amount = where.amount || {};
        where.amount = { ...where.amount, lte: filters.maxAmount };
      }

      // Query with pagination
      const [data, total] = await this.paymentRepository.findAndCount({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
        relations: ['user'], // Include user information
      });

      this.logger.log(`Retrieved ${data.length} payments (total: ${total})`);

      return { data, total };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving payments: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException('Error retrieving payment data');
    }
  }

  /**
   * Get payment details by ID
   * @param id Payment ID
   * @returns Payment details with relations
   * @throws NotFoundException if payment not found
   */
  async getPaymentById(id: string): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id },
        relations: ['user'], // Include user information
      });

      if (!payment) {
        this.logger.warn(`Payment with ID ${id} not found`);
        throw new NotFoundException(`Payment with ID ${id} not found`);
      }

      // Optionally fetch additional data from Stripe
      if (payment.stripePaymentIntentId) {
        try {
          const stripePayment = await this.stripeService.retrievePaymentIntent(
            payment.stripePaymentIntentId,
          );

          // Enhance the payment object with Stripe data
          payment.stripeDetails = stripePayment;
        } catch (stripeError: unknown) {
          const errorMessage =
            stripeError instanceof Error
              ? stripeError.message
              : 'Unknown error';
          const errorStack =
            stripeError instanceof Error ? stripeError.stack : undefined;

          this.logger.warn(
            `Could not retrieve Stripe data for payment ${id}: ${errorMessage}`,
            errorStack,
          );
          // Don't fail the whole request if Stripe data can't be fetched
        }
      }

      this.logger.log(`Retrieved payment details for ID: ${id}`);
      return payment;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error retrieving payment details: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Error retrieving payment details',
      );
    }
  }

  // Other methods remain unchanged...
}
