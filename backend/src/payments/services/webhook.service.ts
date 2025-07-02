import { Injectable, Logger } from '@nestjs/common';
import type { Stripe } from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../../common/services/app-logger.service';
import { StripeEvent } from '../entities/stripe-event.entity';
import { PaymentsService } from '../payments.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(StripeEvent)
    private readonly eventRepository: Repository<StripeEvent>,
    private readonly paymentsService: PaymentsService,
    private readonly loggerService: AppLoggerService,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing Stripe event: ${event.type}`, {
      eventId: event.id,
      eventType: event.type,
      created: event.created,
      livemode: event.livemode,
    });

    try {
      // Check for duplicate event
      const isDuplicate = await this.checkAndMarkEventProcessed(
        event.id,
        event.type,
      );
      if (isDuplicate) return;

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancelled(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error processing Stripe webhook ${event.type}`,
        error instanceof Error ? error.stack : undefined,
        {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        },
      );

      // Now this will work correctly
      this.loggerService.logError('stripe_webhook_error', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private async checkAndMarkEventProcessed(
    eventId: string,
    eventType: string,
  ): Promise<boolean> {
    try {
      // Check if we've seen this event before
      const existingEvent = await this.eventRepository.findOne({
        where: { stripeEventId: eventId },
      });

      if (existingEvent) {
        this.logger.log(`Duplicate webhook event detected: ${eventId}`);
        return true;
      }

      // Store the event to prevent duplicate processing
      await this.eventRepository.save({
        stripeEventId: eventId,
        type: eventType,
        processed: true,
        processedAt: new Date(),
      });

      return false;
    } catch (error) {
      this.logger.error(
        `Error checking for duplicate event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // If we can't check for duplicates, assume it's not a duplicate
      // You could throw an error instead if duplicate detection is critical
      return false;
    }
  }

  // Individual event handlers

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const { id, amount, currency, metadata } = paymentIntent;

    this.logger.log(`Payment intent succeeded: ${id}`, {
      amount,
      currency,
      metadata,
    });

    // This is where we use the paymentsService
    await this.paymentsService.handleSuccessfulPayment(
      id,
      amount,
      currency,
      metadata,
    );
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const { id, metadata, last_payment_error } = paymentIntent;

    this.logger.log(`Payment intent failed: ${id}`, {
      error: last_payment_error?.message || 'Unknown error',
      metadata,
    });

    // Use paymentsService to handle failed payment
    await this.paymentsService.handleFailedPayment(
      id,
      last_payment_error?.message || 'Unknown error',
      metadata,
    );
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const { id, payment_intent, amount_refunded, metadata } = charge;

    this.logger.log(`Charge refunded: ${id}`, {
      paymentIntentId: payment_intent,
      amountRefunded: amount_refunded,
      metadata,
    });

    // Use paymentsService to process refund
    if (typeof payment_intent === 'string') {
      await this.paymentsService.processRefund(
        payment_intent,
        amount_refunded,
        metadata,
      );
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const { id, status, current_period_end, metadata } = subscription;
    // Handle the customer being null or an object
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      this.logger.error(`Subscription ${id} has no customer ID`);
      throw new Error(`Subscription ${id} has no customer ID`);
    }

    this.logger.log(`Subscription updated: ${id}`, {
      customer: customerId,
      status,
      currentPeriodEnd: current_period_end,
      metadata,
    });

    // Use paymentsService to update subscription
    await this.paymentsService.updateSubscription(
      id,
      customerId,
      status,
      current_period_end,
    );
  }

  private async handleSubscriptionCancelled(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const { id, cancel_at, cancel_at_period_end, metadata } = subscription;
    // Handle the customer being null or an object
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      this.logger.error(`Subscription ${id} has no customer ID`);
      throw new Error(`Subscription ${id} has no customer ID`);
    }

    this.logger.log(`Subscription cancelled: ${id}`, {
      customer: customerId,
      cancelAt: cancel_at,
      cancelAtPeriodEnd: cancel_at_period_end,
      metadata,
    });

    // Use paymentsService to cancel subscription
    await this.paymentsService.cancelSubscription(
      id,
      customerId,
      !!cancel_at_period_end,
      metadata as Record<string, any>,
    );
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const { id, subscription, total, currency } = invoice;

    // Handle the customer being null or an object
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId || !subscription) {
      this.logger.error(`Invoice ${id} has no customer ID or subscription`);
      throw new Error(`Invoice ${id} has no customer ID or subscription`);
    }

    this.logger.log(`Invoice payment succeeded: ${id}`, {
      subscriptionId:
        typeof subscription === 'string' ? subscription : subscription.id,
      customer: customerId,
      total,
      currency,
    });

    // Use paymentsService to process invoice payment
    await this.paymentsService.processInvoicePayment(
      id,
      typeof subscription === 'string' ? subscription : subscription.id,
      customerId,
      total,
      currency,
    );
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const { id, subscription, attempt_count } = invoice;

    // Handle the customer being null or an object
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId || !subscription) {
      this.logger.error(`Invoice ${id} has no customer ID or subscription`);
      throw new Error(`Invoice ${id} has no customer ID or subscription`);
    }

    this.logger.log(`Invoice payment failed: ${id}`, {
      subscriptionId:
        typeof subscription === 'string' ? subscription : subscription.id,
      customer: customerId,
      attemptCount: attempt_count,
    });

    // Use paymentsService to handle failed invoice payment
    await this.paymentsService.handleInvoicePaymentFailed(
      id,
      typeof subscription === 'string' ? subscription : subscription.id,
      customerId,
      attempt_count,
    );
  }
}
