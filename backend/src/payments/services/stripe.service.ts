import { Injectable, Logger, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '../../common/services/app-logger.service';
import { VaultService } from '../../config/vault.service';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly appLogger: AppLoggerService,
    private readonly vaultService: VaultService, // Inject the VaultService
  ) {
    // Try to get the Stripe key from Vault first, then fall back to ConfigService
    const stripeKey =
      this.vaultService.getSecret('STRIPE_SECRET_KEY') ||
      this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      this.appLogger.log('STRIPE_SECRET_KEY is not configured');
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-02-24.acacia', // Use the latest API version
    });
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.create(params);
    } catch (error: any) {
      // Combine everything into one string
      this.appLogger.log(
        `Error creating checkout session: ${error.message}\n${error.stack || 'No stack available'}`,
      );
      throw error;
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(
    params: Stripe.CustomerCreateParams,
  ): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.create(params);
    } catch (error: any) {
      // Option 1: Combine message and stack into a single string
      this.appLogger.log(
        `Error creating customer: ${error.message}\n${error.stack || 'No stack available'}`,
      );

      throw error;
    }
  }

  /**
   * Retrieve a customer
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      return (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
    } catch (error: any) {
      this.appLogger.log(
        `Error retrieving customer: ${error.message}\n${error.stack || 'No stack available'}`,
      );
      throw error;
    }
  }

  /**
   * Cancel a subscription in Stripe
   * @param subscriptionId Stripe subscription ID
   * @param cancelImmediately Whether to cancel immediately or at period end
   * @returns Stripe subscription object
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false,
  ): Promise<any> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !cancelImmediately,
      });
    } catch (error: any) {
      // Using the available log method
      this.appLogger.log(
        `Error canceling subscription in Stripe: ${error.message}\n${error.stack || 'No stack available'}`,
      );
      throw error;
    }
  }

  /**
   * Issue a refund
   */
  async createRefund(
    params: Stripe.RefundCreateParams,
  ): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.create(params);
    } catch (error: any) {
      this.appLogger.log(
        `Error creating refund: ${error.message}\n${error.stack || 'No stack available'}`,
      );
      throw error;
    }
  }

  /**
   * Create a customer portal session
   * @param params Portal session creation parameters
   * @returns Created portal session
   */
  async createPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      return await this.stripe.billingPortal.sessions.create(params);
    } catch (error: any) {
      this.appLogger.error(
        `Error creating portal session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate a webhook request from Stripe
   * @param payload The raw request body
   * @param signature The Stripe signature from headers
   * @returns The constructed Stripe event
   */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    // Try Vault first, then fall back to ConfigService
    const webhookSecret =
      this.vaultService.getSecret('STRIPE_WEBHOOK_SECRET') ||
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
      '';

    try {
      this.appLogger.log(
        `[DEBUG] Constructing Stripe event (signature: ${signature})`,
      );

      return this.stripe.webhooks.constructEvent(
        payload.toString(),
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.appLogger.log(
        `[ERROR] Error constructing webhook event: ${error.message}\n${error.stack || 'No stack trace available'}`,
      );
      throw error;
    }
  }

  /**
   * Retrieve a subscription from Stripe
   * @param subscriptionId The ID of the subscription to retrieve
   * @returns The Stripe subscription object
   */
  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error: any) {
      this.appLogger.error(
        `Error retrieving subscription: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
  /**
   * Retrieve a payment intent from Stripe
   */
  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(
        `Error retrieving payment intent: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
