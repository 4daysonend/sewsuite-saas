import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './enums/payment-status.enum'; // Correct path to your enum
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';

interface RefundOptions {
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, any>;
}

@Injectable()
export class RefundService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly ordersService: OrdersService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-02-24.acacia', // Match the expected version
      typescript: true,
    });
  }

  /**
   * Process a refund request
   * @param paymentId ID of the payment to refund
   * @param options Refund options including amount and reason
   * @returns Updated payment entity
   */
  async createRefund(
    paymentId: string,
    options: RefundOptions = {},
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order', 'order.client'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot refund payment with status: ${payment.status}`,
      );
    }

    try {
      // Validate that we have a payment intent ID
      if (!payment.stripePaymentIntentId) {
        throw new BadRequestException(
          'Cannot refund payment without a Stripe payment intent ID',
        );
      }

      // Use a non-null assertion or type assertion
      const paymentIntentId = payment.stripePaymentIntentId as string;

      // Process refund in Stripe
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: options.reason as Stripe.RefundCreateParams.Reason,
        metadata: {
          ...options.metadata,
          orderId: payment.order?.id ? String(payment.order.id) : null, // Convert to string or null
          refundRequestedAt: new Date().toISOString(),
        },
      };

      // Only include amount if it's specified (for partial refunds)
      if (options.amount !== undefined) {
        refundParams.amount = Math.round(options.amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundParams);

      // Update payment record
      payment.status = PaymentStatus.REFUNDED;
      payment.metadata = {
        ...payment.metadata,
        refundId: refund.id,
        refundAmount: refund.amount / 100 || payment.amount,
        refundReason: options.reason,
        refundDate: new Date().toISOString(),
        ...options.metadata,
      };

      await this.paymentRepository.save(payment);

      // Update order status if needed
      if (payment.order) {
        await this.ordersService.updateStatus(payment.order.id, {
          status: OrderStatus.CANCELLED,
          notes: `Order refunded: ${options.reason || 'Customer request'}`,
        });
      }

      // Send refund notification email
      if (payment.order?.client?.email) {
        await this.sendRefundNotification(payment.order.client.email, {
          orderId: payment.order.id,
          // Handle undefined amounts properly:
          amount:
            refund.amount !== undefined
              ? refund.amount / 100
              : payment.amount || 0,
          reason: options.reason,
        });
      }

      return payment;
    } catch (error) {
      this.logger.error(
        `Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Get refund details by refund ID
   * @param refundId Stripe refund ID
   * @returns Refund details from Stripe
   */
  async getRefundDetails(refundId: string): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.retrieve(refundId);
    } catch (error) {
      this.logger.error(
        `Failed to retrieve refund details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Get all refunds for a payment
   * @param paymentIntentId Stripe payment intent ID
   * @returns List of refunds from Stripe
   */
  async getRefundsForPayment(
    paymentIntentId: string,
  ): Promise<Stripe.Refund[]> {
    try {
      const refunds = await this.stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 100,
      });

      return refunds.data;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve refunds for payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Send refund notification email to customer
   * @param email Customer email address
   * @param refundData Refund details
   */
  private async sendRefundNotification(
    email: string,
    refundData: {
      orderId: string;
      amount: number;
      reason?: string;
    },
  ): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: email,
        subject: 'Your Refund Has Been Processed',
        html: this.generateRefundEmailHtml(refundData),
        text: this.generateRefundEmailText(refundData),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send refund notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw here - this is a non-critical operation
    }
  }

  /**
   * Generate HTML email content for refund notification
   * @param data Refund data
   * @returns HTML email content
   */
  private generateRefundEmailHtml(data: {
    orderId: string;
    amount: number;
    reason?: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a4a4a;">Refund Processed</h2>
        <p>Your refund has been processed successfully.</p>
        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Refund Amount:</strong> $${data.amount.toFixed(2)}</p>
          ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <p>The refund should appear on your original payment method within 5-10 business days, depending on your financial institution.</p>
        <p>If you have any questions, please contact our customer support team.</p>
        <p>Thank you for your business.</p>
      </div>
    `;
  }

  /**
   * Generate plain text email content for refund notification
   * @param data Refund data
   * @returns Plain text email content
   */
  private generateRefundEmailText(data: {
    orderId: string;
    amount: number;
    reason?: string;
  }): string {
    return `
Refund Processed

Your refund has been processed successfully.

Order ID: ${data.orderId}
Refund Amount: $${data.amount.toFixed(2)}
${data.reason ? `Reason: ${data.reason}` : ''}
Date: ${new Date().toLocaleDateString()}

The refund should appear on your original payment method within 5-10 business days, depending on your financial institution.

If you have any questions, please contact our customer support team.

Thank you for your business.
    `;
  }

  /**
   * Update refund metadata after processing
   * @param refundId Stripe refund ID
   * @param metadata Metadata to update
   */
  async updateRefundMetadata(
    refundId: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    try {
      await this.stripe.refunds.update(refundId, { metadata });
    } catch (error) {
      this.logger.error(
        `Failed to update refund metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw here - this is a non-critical operation
    }
  }

  /**
   * Check if a payment can be refunded
   * @param paymentId Payment ID
   * @returns Object indicating refundability and any restrictions
   */
  async checkRefundEligibility(paymentId: string): Promise<{
    canRefund: boolean;
    maxAmount?: number;
    reason?: string;
    currency?: string;
    paymentDetails?: {
      id: string;
      amount: number;
      currency: string;
      createdAt: Date;
      description?: string;
    };
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check payment status
    if (payment.status !== PaymentStatus.COMPLETED) {
      return {
        canRefund: false,
        reason: `Payment has status: ${payment.status}`,
      };
    }

    // Check if payment has a Stripe payment intent ID
    if (!payment.stripePaymentIntentId) {
      return {
        canRefund: false,
        reason: 'Payment has no associated Stripe payment intent',
      };
    }

    // Check if already partially refunded
    try {
      const existingRefunds = await this.getRefundsForPayment(
        payment.stripePaymentIntentId,
      );

      const totalRefunded =
        existingRefunds.reduce((sum, refund) => sum + (refund.amount ?? 0), 0) /
        100; // Convert from cents

      // Handle potentially undefined values
      const paymentAmount = payment.amount ?? 0;
      const paymentCurrency = payment.currency ?? 'USD'; // Provide default currency

      if (totalRefunded >= paymentAmount) {
        return {
          canRefund: false,
          reason: 'Payment has already been fully refunded',
        };
      }

      const remainingAmount = paymentAmount - totalRefunded;

      return {
        canRefund: true,
        maxAmount: remainingAmount,
        currency: paymentCurrency,
        paymentDetails: {
          id: payment.id,
          amount: paymentAmount,
          currency: paymentCurrency,
          createdAt: payment.createdAt,
          // No description field
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error checking refund status: ${errorMessage}`);

      return {
        canRefund: false,
        reason: 'Error checking refund status',
      };
    }
  }

  /**
   * Check refund status for a payment
   * @param paymentId Payment ID
   * @returns Object indicating refund status and any issues
   */
  async checkRefundStatus(paymentId: string): Promise<{
    canRefund: boolean;
    reason?: string;
    maxAmount?: number; // Add this to the return type
  }> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        return {
          canRefund: false,
          reason: 'Payment not found',
        };
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        return {
          canRefund: false,
          reason: `Cannot refund payment with status: ${payment.status}`,
        };
      }

      // Handle missing amount explicitly
      if (payment.amount === undefined || payment.amount === null) {
        this.logger.warn(`Payment ${payment.id} has no valid amount`);
        return {
          canRefund: false,
          reason: 'Payment has no valid amount to refund',
        };
      }

      // Check for missing payment intent ID
      if (!payment.stripePaymentIntentId) {
        this.logger.warn(
          `Payment ${payment.id} has no Stripe payment intent ID`,
        );
        return {
          canRefund: false,
          reason: 'Payment has no associated Stripe payment intent',
        };
      }

      const existingRefunds = await this.getRefundsForPayment(
        payment.stripePaymentIntentId,
      );

      const totalRefunded =
        existingRefunds.reduce((sum, refund) => sum + (refund.amount ?? 0), 0) /
        100;

      if (totalRefunded >= payment.amount) {
        return {
          canRefund: false,
          reason: 'Payment has already been fully refunded',
        };
      }

      // Now you can include maxAmount in the return object
      return {
        canRefund: true,
        maxAmount: payment.amount - totalRefunded, // Add the max amount that can be refunded
      };
    } catch (error) {
      this.logger.error(
        `Error checking refund status: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        canRefund: false,
        reason: 'An error occurred while checking refund status',
      };
    }
  }
}
