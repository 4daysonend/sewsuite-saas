import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from './email.service';

interface PaymentConfirmationJobData {
  email: string;
  data: {
    orderId: string;
    amount: number;
    date: Date;
    customerName?: string;
    paymentId: string;
  };
}

interface PaymentFailedJobData {
  email: string;
  data: {
    orderId: string;
    amount: number;
    failureReason?: string;
  };
}

@Processor('email')
export class EmailConsumer {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('payment-confirmation')
  async handlePaymentConfirmation(job: Job<PaymentConfirmationJobData>) {
    this.logger.debug(`Processing payment confirmation email job ${job.id}`);
    const { email, data } = job.data;

    try {
      await this.emailService.sendOrderPaymentConfirmation(email, {
        orderId: data.orderId,
        amount: data.amount,
        date: new Date(data.date),
        customerName: data.customerName,
      });

      this.logger.log(
        `Payment confirmation email sent to ${email} for order ${data.orderId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send payment confirmation email to ${email} for order ${data.orderId}: ${error.message}`,
        error.stack,
      );
      // Re-throw the error to trigger Bull's retry mechanism
      throw error;
    }
  }

  @Process('payment-failed')
  async handlePaymentFailed(job: Job<PaymentFailedJobData>) {
    this.logger.debug(`Processing payment failed notification job ${job.id}`);
    const { email, data } = job.data;

    try {
      await this.emailService.sendOrderPaymentFailedNotification(email, {
        orderId: data.orderId,
        amount: data.amount,
        date: new Date(),
      });

      this.logger.log(
        `Payment failure notification sent to ${email} for order ${data.orderId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send payment failure notification to ${email} for order ${data.orderId}: ${error.message}`,
        error.stack,
      );
      // Re-throw the error to trigger Bull's retry mechanism
      throw error;
    }
  }

  @Process('retry-email')
  async handleEmailRetry(job: Job<any>) {
    this.logger.debug(`Processing email retry job ${job.id}`);
    const { _metadata, ...options } = job.data;

    try {
      await this.emailService.sendEmail(options);
      this.logger.log(`Retry email sent successfully: ${job.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to retry email: ${error.message}`, error.stack);

      // Update metadata for next retry
      if (_metadata) {
        _metadata.attempt += 1;

        // If we haven't exceeded max attempts, we'll throw to trigger retry
        if (_metadata.attempt <= _metadata.maxAttempts) {
          this.logger.log(
            `Email retry attempt ${_metadata.attempt}/${_metadata.maxAttempts} failed, will retry again`,
          );
          throw error;
        } else {
          this.logger.error(
            `Email retry failed after ${_metadata.attempt} attempts`,
          );
        }
      }

      throw error;
    }
  }
}
