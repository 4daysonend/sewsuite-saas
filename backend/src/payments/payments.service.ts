import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Stripe from 'stripe';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-01-13',
    });
  }

  async createPaymentIntent(
    orderId: string,
  ): Promise<{ clientSecret: string }> {
    const order = await this.ordersService.findById(orderId);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: order.price * 100, // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: order.id,
        },
      });

      await this.paymentRepository.save({
        stripePaymentIntentId: paymentIntent.id,
        amount: order.price,
        currency: 'usd',
        status: PaymentStatus.PENDING,
        order: order,
      });

      return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw error;
    }
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.configService.get('STRIPE_WEBHOOK_SECRET'),
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
      }
    } catch (error) {
      this.logger.error(`Webhook Error: ${error.message}`);
      throw error;
    }
  }

  private async handlePaymentSuccess(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
      relations: ['order'],
    });

    if (payment) {
      payment.status = PaymentStatus.COMPLETED;
      await this.paymentRepository.save(payment);

      // Update order status
      await this.ordersService.updateStatus(
        payment.order.id,
        'PAYMENT_COMPLETED',
      );

      // Send confirmation email
      await this.emailService.sendPaymentConfirmation(
        payment.order.client.email,
        {
          orderId: payment.order.id,
          amount: payment.amount,
          date: new Date(),
        },
      );
    }
  }

  private async handlePaymentFailure(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
      relations: ['order'],
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepository.save(payment);

      // Update order status
      await this.ordersService.updateStatus(payment.order.id, 'PAYMENT_FAILED');

      // Send failure notification
      await this.emailService.sendPaymentFailureNotification(
        payment.order.client.email,
        {
          orderId: payment.order.id,
          amount: payment.amount,
        },
      );
    }
  }
}
