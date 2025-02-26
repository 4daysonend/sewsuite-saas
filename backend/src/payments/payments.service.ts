import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { EmailService } from '../email/email.service';
import { OrderStatus } from '../orders/entities/order.entity';

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
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly webhookSecret: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
    
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
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

      // Create payment record in database
      await this.paymentRepository.save({
        stripePaymentIntentId: paymentIntent.id,
        amount: Number(order.price),
        currency: 'usd',
        status: PaymentStatus.PENDING,
        order: order,
        metadata: {
          customerEmail: order.client?.email,
          created: new Date().toISOString(),
        },
      });

      return { 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
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
        error instanceof Error ? error.message : 'Failed to create payment intent'
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
        throw new BadRequestException(validationResult.error || 'Invalid webhook');
      }

      const event = validationResult.event;

      // Process different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
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
          error: 'Webhook secret not configured'
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
        error: error instanceof Error ? error.message : 'Invalid webhook'
      };
    }
  }

  /**
   * Handle successful payment
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
      relations: ['order', 'order.client'],
    });

    if (!payment) {
      this.logger.warn(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

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

    // Update order status
    try {
      await this.ordersService.updateStatus(
        payment.order.id,
        {
          status: OrderStatus.CONFIRMED,
          notes: 'Payment successfully processed'
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Send confirmation email
    if (payment.order.client?.email) {
      try {
        await this.emailService.sendOrderPaymentConfirmation(
          payment.order.client.email,
          {
            orderId: payment.order.id,
            amount: payment.amount,
            date: new Date(),
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to send payment confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  /**
   * Handle failed payment
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
      relations: ['order', 'order.client'],
    });

    if (!payment) {
      this.logger.warn(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    payment.status = PaymentStatus.FAILED;
    payment.metadata = {
      ...payment.metadata,
      failedAt: new Date().toISOString(),
      failureCode: paymentIntent.last_payment_error?.code || 'unknown',
      failureMessage: paymentIntent.last_payment_error?.message || 'Payment processing failed',
    };
    
    await this.paymentRepository.save(payment);

    // Update order status
    try {
      await this.ordersService.updateStatus(
        payment.order.id,
        {
          status: OrderStatus.PAYMENT_FAILED,
          notes: paymentIntent.last_payment_error?.message || 'Payment processing failed'
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Send failure notification
    if (payment.order.client?.email) {
      try {
        await this.emailService.sendOrderPaymentFailedNotification(
          payment.order.client.email,
          {
            orderId: payment.order.id,
            amount: payment.amount,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to send payment failure notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
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

    const paymentIntentId = typeof charge.payment_intent === 'string' 
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
  async findByPaymentIntentId(paymentIntentId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: ['order', 'order.client'],
    });
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
}