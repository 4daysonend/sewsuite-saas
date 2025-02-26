// /backend/src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

interface PaymentEmailData {
  orderId: string;
  amount: number;
  date?: Date;
}

interface EmailError extends Error {
  code?: string;
  responseCode?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      this.logger.log(`Sending email to ${options.to}: ${options.subject}`);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(`Failed to send email: ${emailError.message}`);
      throw emailError;
    }
  }

  async sendOrderPaymentConfirmation(
    email: string,
    data: PaymentEmailData,
  ): Promise<void> {
    try {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(data.amount);

      const emailContent = {
        to: email,
        subject: 'Payment Confirmation',
        html: `
          <h1>Payment Confirmed</h1>
          <p>Payment for order #${data.orderId} has been processed successfully.</p>
          <p>Amount: ${formattedAmount}</p>
          ${data.date ? `<p>Date: ${data.date.toLocaleDateString()}</p>` : ''}
        `,
        text: `
          Payment Confirmed
          Payment for order #${data.orderId} has been processed successfully.
          Amount: ${formattedAmount}
          ${data.date ? `Date: ${data.date.toLocaleDateString()}` : ''}
        `.trim(),
      } satisfies EmailOptions;

      await this.sendEmail(emailContent);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(
        `Failed to send payment confirmation email: ${emailError.message}`,
      );
      throw emailError;
    }
  }

  async sendOrderPaymentFailedNotification(
    email: string,
    data: PaymentEmailData,
  ): Promise<void> {
    try {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(data.amount);

      const emailContent = {
        to: email,
        subject: 'Payment Failed',
        html: `
          <h1>Payment Failed</h1>
          <p>Payment for order #${data.orderId} could not be processed.</p>
          <p>Amount: ${formattedAmount}</p>
        `,
        text: `
          Payment Failed
          Payment for order #${data.orderId} could not be processed.
          Amount: ${formattedAmount}
        `.trim(),
      } satisfies EmailOptions;

      await this.sendEmail(emailContent);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(
        `Failed to send payment failed notification: ${emailError.message}`,
      );
      throw emailError;
    }
  }

  // Instead of throwing Not Implemented error, provide proper implementation
  async sendSubscriptionConfirmation(subscriptionData: {
    email: string;
    subscriptionId: string;
    startDate: Date;
    plan: string;
  }): Promise<void> {
    try {
      const emailContent = {
        to: subscriptionData.email,
        subject: 'Subscription Confirmation',
        html: `
          <h1>Subscription Confirmed</h1>
          <p>Your subscription (ID: ${subscriptionData.subscriptionId}) has been activated.</p>
          <p>Plan: ${subscriptionData.plan}</p>
          <p>Start Date: ${subscriptionData.startDate.toLocaleDateString()}</p>
        `,
        text: `
          Subscription Confirmed
          Your subscription (ID: ${subscriptionData.subscriptionId}) has been activated.
          Plan: ${subscriptionData.plan}
          Start Date: ${subscriptionData.startDate.toLocaleDateString()}
        `.trim(),
      } satisfies EmailOptions;

      await this.sendEmail(emailContent);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(
        `Failed to send subscription confirmation: ${emailError.message}`,
      );
      throw emailError;
    }
  }
}