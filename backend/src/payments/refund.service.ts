import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stripe } from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class RefundService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-01-13',
    });
  }

  async createRefund(
    paymentId: string,
    amount?: number,
    reason?: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order', 'order.client'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount || undefined,
        reason: (reason as Stripe.RefundCreateParams.Reason) || undefined,
      });

      payment.status = PaymentStatus.REFUNDED;
      payment.metadata = {
        ...payment.metadata,
        refundId: refund.id,
        refundAmount: refund.amount,
        refundReason: reason,
        refundDate: new Date(),
      };

      await this.paymentRepository.save(payment);

      // Send refund notification
      await this.emailService.sendRefundNotification(
        payment.order.client.email,
        {
          orderId: payment.order.id,
          amount: refund.amount / 100,
          reason: reason,
        },
      );

      return payment;
    } catch (error) {
      this.logger.error(`Failed to process refund: ${error.message}`);
      throw error;
    }
  }
}
