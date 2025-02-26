import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment, PaymentStatus } from './entities/payment.entity';
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
      apiVersion: '2024-12-18.acacia',
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
      // Calculate refund amount (full refund if not specified)
      const amountToRefund = options.amount !== undefined
        ? Math.round(options.amount * 100)
        : undefined;

      // Process refund in Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amountToRefund,
        reason: options.reason,
        metadata: {
          ...options.metadata,
          orderId: payment.order?.id,
          refundRequestedAt: new Date().toISOString(),
        },
      });

      // Update payment record
      payment.status = PaymentStatus.REFUNDED;
      payment.metadata = {
        ...payment.metadata,
        refundId: refund.id,
        refundAmount: (refund.amount / 100) || payment.amount,
        refundReason: options.reason,
        refundDate: new Date().toISOString(),
        ...options.metadata,
      };

      await this.paymentRepository.save(payment);

      // Update order status if needed
      if (payment.order) {
        await this.ordersService.updateStatus(
          payment.order.id,
          {
            status: OrderStatus.CANCELLED,
            notes: `Order refunded: ${options.reason || 'Customer request'}`
          },
        );
      }

      // Send refund notification email
      if (payment.order?.client?.email) {
        await this.sendRefundNotification(
          payment.order.client.email,
          {
            orderId: payment.order.id,
            amount: (refund.amount / 100) || payment.amount,
            reason: options.reason,
          }
        );
      }

      return payment;
    } catch (error) {
      this.logger.error(
        `Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
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
  async getRefundsForPayment(paymentIntentId: string): Promise<Stripe.Refund[]> {
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
    }
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
    metadata: Record<string, string>
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

    // Check if already partially refunded
    try {
      const existingRefunds = await this.getRefundsForPayment(payment.stripePaymentIntentId);
      const totalRefunded = existingRefunds.reduce(
        (sum, refund) => sum + refund.amount,
        0
      ) / 100; // Convert from cents

      if (totalRefunded >= payment.amount) {
        return {
          canRefund: false,
          reason: 'Payment has already been fully refunded',
        };
      }

      const remainingAmount = payment.amount - totalRefunded;

      return {
        canRefund: true,
        maxAmount: remainingAmount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check refund eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      
      return {
        canRefund: false,
        reason: 'Failed to verify refund eligibility with payment processor',
      };
    }
  }
}