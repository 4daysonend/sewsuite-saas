import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Stripe from 'stripe';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { AppLoggerService } from '../common/services/app-logger.service';
import { DeepPartial } from 'typeorm';

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

interface WebhookValidationResult {
  isValid: boolean;
  event?: Stripe.Event;
  error?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly loggerService: AppLoggerService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });

    this.webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
      '',
    );
  }

  /**
   * Create a payment intent for an order
   * @param orderId Order to create payment for
   * @returns Payment intent client secret
   */
  async createPaymentIntent(orderId: string): Promise<PaymentIntentResponse> {
    try {
      const order = await this.ordersService.findOne(orderId);

      // Create payment intent in Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(order.price) * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: order.id,
          customerEmail: order.client?.email || '',
        },
        receipt_email: order.client?.email,
      });

      if (!paymentIntent.client_secret) {
        throw new Error('Failed to generate client secret');
      }

      // Create payment record in database - Fixed to use proper relation
      await this.paymentRepository.save({
        stripePaymentIntentId: paymentIntent.id,
        amount: Number(order.price),
        currency: 'usd',
        status: PaymentStatus.PENDING,
        orderId: order.id, // Use orderId instead of order: order
        metadata: {
          customerEmail: order.client?.email,
          created: new Date().toISOString(),
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to create payment intent',
      );
    }
  }

  /**
   * Handle incoming webhook from Stripe
   * @param signature Stripe signature header
   * @param rawBody Raw request body
   */
  async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
    try {
      // Validate webhook
      const validationResult = await this.validateWebhook(signature, rawBody);

      if (!validationResult.isValid || !validationResult.event) {
        throw new BadRequestException(
          validationResult.error || 'Invalid webhook',
        );
      }

      const event = validationResult.event;

      // Process different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object as Stripe.Charge);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Validate incoming webhook from Stripe
   * @param signature Stripe signature header
   * @param rawBody Raw request body
   * @returns Validation result with event if valid
   */
  private async validateWebhook(
    signature: string,
    rawBody: Buffer,
  ): Promise<WebhookValidationResult> {
    try {
      if (!this.webhookSecret) {
        return {
          isValid: false,
          error: 'Webhook secret not configured',
        };
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );

      return { isValid: true, event };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid webhook',
      };
    }
  }

  /**
   * Handle successful payment
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentSuccess(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
      relations: ['order', 'order.client'], // Loading the relations
    });

    if (!payment) {
      this.logger.warn(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    // Use the loaded relation instead of fetching again
    const order = payment.order || null;
    const client = order?.client;

    // Update payment status
    payment.status = PaymentStatus.COMPLETED;
    payment.metadata = {
      ...payment.metadata,
      completedAt: new Date().toISOString(),
      paymentMethod: paymentIntent.payment_method_types?.[0] || 'unknown',
      paymentDetails: {
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethodId: paymentIntent.payment_method,
      },
    };

    await this.paymentRepository.save(payment);

    // Update order status if we found an order
    if (order) {
      try {
        await this.ordersService.updateStatus(order.id, {
          status: OrderStatus.CONFIRMED,
          notes: 'Payment successfully processed',
        });
      } catch (error) {
        this.logger.error(
          `Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Queue payment confirmation email
      if (client?.email) {
        try {
          // Add job to email queue for asynchronous processing
          await this.emailQueue.add(
            'payment-confirmation',
            {
              email: client.email,
              data: {
                orderId: order.id,
                amount: payment.amount,
                date: new Date(),
                customerName: client.firstName
                  ? `${client.firstName} ${client.lastName || ''}`
                  : 'Valued Customer',
                paymentId: payment.id,
              },
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );

          this.logger.log(
            `Payment confirmation email queued for order: ${order.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to queue payment confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }
  }

  /**
   * Handle failed payment
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentFailure(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
      relations: ['order', 'order.client'], // Loading the relations
    });

    if (!payment) {
      this.logger.warn(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment
    payment.status = PaymentStatus.FAILED;
    payment.metadata = {
      ...payment.metadata,
      failedAt: new Date().toISOString(),
      failureCode: paymentIntent.last_payment_error?.code || 'unknown',
      failureMessage:
        paymentIntent.last_payment_error?.message ||
        'Payment processing failed',
    };

    await this.paymentRepository.save(payment);

    // Update order status - using optional chaining
    if (payment.order) {
      // Check if order exists first
      try {
        await this.ordersService.updateStatus(payment.order.id, {
          status: OrderStatus.PAYMENT_FAILED,
          notes:
            paymentIntent.last_payment_error?.message ||
            'Payment processing failed',
        });
      } catch (error) {
        this.logger.error(
          `Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Queue payment failure notification email - use optional chaining for client
      if (payment.order.client?.email) {
        try {
          await this.emailQueue.add(
            'payment-failed',
            {
              email: payment.order.client.email,
              data: {
                orderId: payment.order.id,
                amount: payment.amount,
                failureReason:
                  paymentIntent.last_payment_error?.message || 'Unknown error',
              },
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
        } catch (error) {
          this.logger.error(
            `Failed to queue payment failure email: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } else {
      this.logger.warn(
        `Payment ${payment.id} is not associated with any order`,
      );
    }
  }

  /**
   * Handle refund event
   * @param charge Stripe charge object
   */
  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    // Find payment by payment intent ID
    if (!charge.payment_intent) {
      this.logger.warn('Refund received without payment_intent reference');
      return;
    }

    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent.id;

    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: ['order', 'order.client'],
    });

    if (!payment) {
      this.logger.warn(`Payment not found for refund: ${paymentIntentId}`);
      return;
    }

    // Update payment status
    payment.status = PaymentStatus.REFUNDED;
    payment.metadata = {
      ...payment.metadata,
      refundedAt: new Date().toISOString(),
      refundId: charge.refunds?.data[0]?.id,
      refundAmount: charge.amount_refunded / 100,
      refundReason: charge.refunds?.data[0]?.reason,
    };

    await this.paymentRepository.save(payment);

    // No need to update order status here, as that would be handled by RefundService
  }

  /**
   * Get payment by ID
   * @param id Payment ID
   * @returns Payment entity
   */
  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order', 'order.client'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  /**
   * Find payment by Stripe payment intent ID
   * @param paymentIntentId Stripe payment intent ID
   * @returns Payment entity
   */
  async findByPaymentIntentId(
    paymentIntentId: string,
  ): Promise<Payment | null> {
    try {
      return await this.paymentRepository.findOne({
        where: { stripePaymentIntentId: paymentIntentId },
        relations: ['order', 'order.client'],
      });
    } catch (error) {
      this.logger.error(
        `Error finding payment by intent ID: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Get payments for an order
   * @param orderId Order ID
   * @returns Array of payments
   */
  async getPaymentsForOrder(orderId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { order: { id: orderId } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Handle a successful payment intent
   */
  async handleSuccessfulPayment(
    paymentIntentId: string,
    amount: number,
    currency: string,
    metadata: Stripe.MetadataParam,
  ): Promise<void> {
    try {
      this.logger.log(`Processing successful payment: ${paymentIntentId}`);

      // Extract useful information from metadata
      const userId = metadata?.userId;
      const orderId = metadata?.orderId;

      // Create a payment entity (removed unused interface)
      const paymentData: DeepPartial<Payment> = {
        stripePaymentIntentId: paymentIntentId,
        amount: amount / 100,
        currency,
        status: PaymentStatus.COMPLETED,
      };

      // Only add userId if it exists
      if (userId) {
        paymentData.userId = String(userId);
      }

      const payment = this.paymentRepository.create(paymentData);

      // If metadata exists on your entity, set it separately
      if ('metadata' in payment) {
        (payment as any).metadata = {
          ...(metadata as Record<string, any>),
          orderId,
        };
      }

      // Then save it
      await this.paymentRepository.save(payment);

      // If this is tied to an order, update the order status
      if (orderId) {
        this.logger.log(`Updated order ${orderId} payment status to paid`);
      }

      // Use the logger methods that exist
      this.logger.log(`[INFO] Payment succeeded: ${paymentIntentId}`);
    } catch (error) {
      // Use the logger methods that exist
      this.logger.log(
        `[ERROR] Failed to process payment: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    }
  }

  /**
   * Handle a failed payment intent
   */
  async handleFailedPayment(
    paymentIntentId: string,
    errorMessage: string,
    metadata: Stripe.MetadataParam,
  ): Promise<void> {
    try {
      this.logger.log(`Processing failed payment: ${paymentIntentId}`);

      // Extract useful information from metadata
      const userId = metadata?.userId;
      const orderId = metadata?.orderId;

      // First create a payment entity with proper structure
      const payment = this.paymentRepository.create({
        stripePaymentIntentId: paymentIntentId,
        amount: undefined, // Use undefined instead of null
        currency: 'USD',
        status: PaymentStatus.FAILED,
        errorMessage,
        // Only set userId if it exists, and ensure it's a string
        ...(userId ? { userId: String(userId) } : {}),
      });

      // Set metadata separately
      if (metadata) {
        payment.metadata = {
          ...(metadata as Record<string, any>),
          orderId,
        };
      }

      // Then save it
      await this.paymentRepository.save(payment);

      this.logger.log(`Created failed payment record for: ${paymentIntentId}`);

      // Update order status if needed
      if (orderId) {
        // Additional logic for order updates
      }
    } catch (error) {
      this.logger.log(
        `Error processing failed payment: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(
    paymentIntentId: string,
    amountRefunded: number,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      this.logger.log(`Processing refund for payment: ${paymentIntentId}`);

      // Find the original payment
      const originalPayment = await this.paymentRepository.findOne({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (!originalPayment) {
        throw new Error(
          `Original payment not found for refund: ${paymentIntentId}`,
        );
      }

      // Check if amount is available
      if (
        originalPayment.amount === undefined ||
        originalPayment.amount === null
      ) {
        this.logger.warn(
          `Payment ${paymentIntentId} has no amount recorded, cannot determine refund status accurately`,
        );
      }

      const originalAmount = originalPayment.amount ?? 0;
      const isFullRefund = amountRefunded === originalAmount * 100;

      // Create a record of the refund
      await this.paymentRepository.save({
        stripePaymentIntentId: paymentIntentId,
        relatedPaymentId: originalPayment.id,
        amount: amountRefunded / 100, // Convert from cents
        currency: originalPayment.currency,
        status: 'refunded',
        userId: originalPayment.userId,
        orderId: originalPayment.orderId,
        metadata: {
          ...metadata,
          originalPaymentId: originalPayment.id,
          refundType: isFullRefund ? 'full' : 'partial',
          originalAmount: originalAmount,
        },
      });

      // Update the original payment
      await this.paymentRepository.update(
        { stripePaymentIntentId: paymentIntentId },
        {
          status: isFullRefund ? 'refunded' : 'partially_refunded',
          refundedAmount: amountRefunded / 100,
        },
      );

      // If this is tied to an order, update the order
      if (originalPayment.orderId) {
        // await this.orderService.handleRefund(originalPayment.orderId, amountRefunded / 100);
        this.logger.log(`Updated order ${originalPayment.orderId} for refund`);
      }

      // Log the refund
      this.loggerService.logInfo('payment_refunded', {
        paymentIntentId,
        amountRefunded: amountRefunded / 100,
        isFullRefund,
        userId: originalPayment.userId,
        orderId: originalPayment.orderId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process refund: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      this.loggerService.logError('refund_processing_error', {
        paymentIntentId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Update subscription information
   */
  async updateSubscription(
    subscriptionId: string,
    customerId: string,
    status: string,
    currentPeriodEnd: number,
  ): Promise<void> {
    try {
      // Find existing subscription
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (existingSubscription) {
        // Update existing subscription
        await this.subscriptionRepository.update(
          { stripeSubscriptionId: subscriptionId },
          {
            status,
            currentPeriodEnd: new Date(currentPeriodEnd * 1000),
            updatedAt: new Date(),
          },
        );

        this.logger.log(`Updated existing subscription: ${subscriptionId}`);
      } else {
        // Get customer information to determine user ID
        let userId: string | undefined = undefined;

        try {
          const customerResponse =
            await this.stripe.customers.retrieve(customerId);

          // Check if the customer is deleted
          if ((customerResponse as Stripe.DeletedCustomer).deleted !== true) {
            // Customer is not deleted, safe to access metadata
            const customer = customerResponse as Stripe.Customer;
            userId = customer.metadata?.userId;
          } else {
            this.logger.warn(`Customer ${customerId} has been deleted`);
          }
        } catch (error) {
          this.logger.error(
            `Failed to retrieve customer details: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        }

        if (!userId) {
          this.logger.warn(
            `No userId found in customer metadata for customer: ${customerId}`,
          );
        }

        // Create new subscription record with proper types
        const subscriptionData: DeepPartial<Subscription> = {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          status,
          currentPeriodEnd: new Date(currentPeriodEnd * 1000),
        };

        // Only add userId if it exists
        if (userId) {
          subscriptionData.userId = userId;
        }

        const subscription =
          this.subscriptionRepository.create(subscriptionData);
        await this.subscriptionRepository.save(subscription);

        this.logger.log(`Created new subscription record: ${subscriptionId}`);
      }

      // Log the subscription update
      this.loggerService.logInfo('subscription_updated', {
        subscriptionId,
        customerId,
        status,
        currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      });
    } catch (error) {
      this.logger.error(
        `Failed to update subscription: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    customerId: string,
    cancelAtPeriodEnd: boolean,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      this.logger.log(`Cancelling subscription: ${subscriptionId}`);

      // Find existing subscription
      const existingSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (!existingSubscription) {
        this.logger.warn(`Subscription not found for ID: ${subscriptionId}`);

        // Create a cancelled subscription record anyway
        await this.subscriptionRepository.save({
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          status: 'canceled',
          canceledAt: new Date(),
          cancelAtPeriodEnd: cancelAtPeriodEnd,
          metadata,
        });
      } else {
        // Update existing subscription to canceled status
        await this.subscriptionRepository.update(
          { stripeSubscriptionId: subscriptionId },
          {
            status: 'canceled',
            canceledAt: new Date(),
            cancelAtPeriodEnd: cancelAtPeriodEnd,
            metadata: {
              ...existingSubscription.metadata,
              ...metadata,
              cancellationReason: metadata?.cancellationReason || 'Unknown',
            },
          },
        );
      }

      // If this is a user-initiated cancellation, you might want to trigger other events
      if (metadata?.cancellationReason === 'user_requested') {
        // For example, send a cancellation email or trigger other actions
      }

      // Log the subscription cancellation
      this.loggerService.logInfo('subscription_canceled', {
        subscriptionId,
        customerId,
        cancelAtPeriodEnd,
        metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process subscription cancellation: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      this.loggerService.logError('subscription_cancellation_error', {
        subscriptionId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Process a successful invoice payment
   */
  async processInvoicePayment(
    invoiceId: string,
    subscriptionId: string,
    customerId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    try {
      this.logger.log(`Processing invoice payment: ${invoiceId}`);

      // Find the associated subscription
      const subscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscriptionId },
      });

      // If subscription exists, use its user ID
      const userId = subscription?.userId;

      // Create a payment record
      await this.paymentRepository.save({
        stripeInvoiceId: invoiceId,
        stripeSubscriptionId: subscriptionId,
        amount: amount / 100, // Convert from cents
        currency,
        status: 'succeeded',
        userId,
        metadata: {
          subscriptionId,
          customerId,
          invoiceId,
        },
      });

      // Update subscription status if needed
      if (subscription && subscription.status !== 'active') {
        await this.subscriptionRepository.update(
          { id: subscription.id },
          { status: 'active' },
        );
      }

      // Log the invoice payment
      this.loggerService.logInfo('invoice_payment_succeeded', {
        invoiceId,
        subscriptionId,
        customerId,
        amount: amount / 100,
        currency,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process invoice payment: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      this.loggerService.logError('invoice_payment_processing_error', {
        invoiceId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Handle a failed invoice payment
   */
  async handleInvoicePaymentFailed(
    invoiceId: string,
    subscriptionId: string,
    customerId: string,
    attemptCount: number,
  ): Promise<void> {
    try {
      this.logger.log(`Processing failed invoice payment: ${invoiceId}`);

      // Find the associated subscription
      const subscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscriptionId },
      });

      // Create a record of the failed payment
      await this.paymentRepository.save({
        stripeInvoiceId: invoiceId,
        stripeSubscriptionId: subscriptionId,
        status: 'failed',
        errorMessage: `Invoice payment failed after ${attemptCount} attempts`,
        userId: subscription?.userId,
        metadata: {
          subscriptionId,
          customerId,
          invoiceId,
          attemptCount,
        },
      });

      // If we have too many failures, mark subscription as past_due
      if (subscription && attemptCount >= 3) {
        await this.subscriptionRepository.update(
          { id: subscription.id },
          { status: 'past_due' },
        );

        // Notify the user of payment issues if you have their contact info
        if (subscription.userId) {
          // You could send an email or notification here
          // await this.emailService.sendPaymentFailureNotification(subscription.userId);
        }
      }

      // Log the failed invoice payment
      this.loggerService.logWarning('invoice_payment_failed', {
        invoiceId,
        subscriptionId,
        customerId,
        attemptCount,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process failed invoice payment: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      this.loggerService.logError('invoice_payment_failure_processing_error', {
        invoiceId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Update customer metadata
   */
  async updateCustomerMetadata(
    customerId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      // First retrieve the customer to check if it exists
      const customerResponse = await this.stripe.customers.retrieve(customerId);

      // Check if customer was deleted
      if ((customerResponse as Stripe.DeletedCustomer).deleted) {
        throw new BadRequestException(
          'Cannot update metadata for deleted customer',
        );
      }

      // Update customer with new metadata
      await this.stripe.customers.update(customerId, {
        metadata: metadata,
      });

      this.logger.log(`Updated metadata for customer ${customerId}`);
    } catch (error) {
      this.logger.log(
        `Error updating customer metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
