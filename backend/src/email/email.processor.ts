// /backend/src/email/email.processor.ts
import {
  Process,
  Processor,
  OnQueueFailed,
  OnQueueStalled,
  OnQueueError,
  InjectQueue,
} from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { EmailOptions } from './interfaces/email-options.interface';
import { Queue } from 'bull';

interface EmailConfig {
  service: string;
  auth: {
    user: string;
    pass: string;
  };
  connectionTimeout: number;
  socketTimeout: number;
}

interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  messageId?: string;
}

@Injectable()
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email-dlq') private readonly deadLetterQueue: Queue,
  ) {
    const emailConfig: EmailConfig = {
      service: this.configService.get<string>('EMAIL_SERVICE') ?? '',
      auth: {
        user: this.configService.get<string>('EMAIL_USER') ?? '',
        pass: this.configService.get<string>('EMAIL_PASSWORD') ?? '',
      },
      connectionTimeout:
        this.configService.get<number>('EMAIL_CONNECTION_TIMEOUT') ?? 30000,
      socketTimeout:
        this.configService.get<number>('EMAIL_SOCKET_TIMEOUT') ?? 30000,
    };

    this.transporter = nodemailer.createTransport(emailConfig);

    this.maxRetries = this.configService.get<number>('EMAIL_MAX_RETRIES') ?? 3;

    this.verifyTransporterConnection();
  }

  private async verifyTransporterConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error(
        `SMTP connection verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Process({
    name: 'send-email',
    concurrency: 5,
  })
  async handleSendEmail(job: Job<EmailOptions>): Promise<any> {
    const startTime = Date.now();
    const { id, attemptsMade } = job;

    this.logger.log(
      `Processing email job ${id} (attempt ${attemptsMade + 1}/${this.maxRetries + 1})`,
    );

    try {
      const { to, subject, html, text } = job.data;

      const mailOptions: SendMailOptions = {
        from: this.configService.get<string>('EMAIL_FROM') ?? '',
        to,
        subject,
        html,
        text,
        messageId: `${id}@sewsuite.app`,
      };

      await job.progress(50);

      const result = await this.transporter.sendMail(mailOptions);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Email sent successfully to ${to} (job ${id}, messageId: ${result.messageId}, took ${processingTime}ms)`,
      );

      await job.progress(100);

      return {
        messageId: result.messageId,
        recipient: to,
        sentAt: new Date(),
        processingTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to send email (job ${id}, attempt ${attemptsMade + 1}/${this.maxRetries + 1}): ${errorMessage}`,
        errorStack,
      );

      if (attemptsMade >= this.maxRetries) {
        this.logger.warn(
          `Email job ${id} has reached maximum retry attempts (${this.maxRetries}). Moving to dead-letter queue.`,
        );

        await this.moveToDeadLetterQueue(job, errorMessage);

        throw new Error(`Max retries reached: ${errorMessage}`);
      }

      throw error;
    }
  }

  @OnQueueFailed()
  async onQueueFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Email job ${job.id} failed (attempt ${job.attemptsMade}/${this.maxRetries + 1}): ${error.message}`,
      error.stack,
    );

    const isCritical = job.attemptsMade >= Math.ceil(this.maxRetries / 2);
    if (isCritical) {
      await this.alertFailure(job, error);
    }
  }

  @OnQueueStalled()
  async onQueueStalled(job: Job): Promise<void> {
    this.logger.warn(`Email job ${job.id} stalled and will be reprocessed`);
  }

  @OnQueueError()
  onQueueError(error: Error): void {
    this.logger.error(`Email queue error: ${error.message}`, error.stack);
  }

  private async moveToDeadLetterQueue(
    job: Job,
    errorMessage: string,
  ): Promise<void> {
    try {
      const dlqData = {
        originalJobId: job.id,
        failedAt: new Date(),
        attempts: job.attemptsMade,
        errorMessage,
        originalData: job.data,
      };

      // Use the injected queue directly
      const result = await this.deadLetterQueue.add('failed-email', dlqData);

      this.logger.log(
        `Moved job ${job.id} to dead-letter queue after ${job.attemptsMade} failed attempts. New DLQ job ID: ${result.id}`,
      );
    } catch (dlqError: unknown) {
      this.logger.error(
        `Failed to move job ${job.id} to dead-letter queue: ${
          dlqError instanceof Error ? dlqError.message : 'Unknown error'
        }`,
      );

      // You might want to handle DLQ errors differently, perhaps alerting an admin
      // or recording the failure somewhere else for manual intervention
    }
  }

  private async alertFailure(job: Job, error: Error): Promise<void> {
    try {
      this.logger.warn(
        `ALERT: Critical email failure for job ${job.id}. Recipient: ${job.data.to}, Error: ${error.message}`,
      );
    } catch (alertError) {
      this.logger.error(
        `Failed to send alert for job ${job.id}: ${alertError instanceof Error ? alertError.message : 'Unknown error'}`,
      );
    }
  }
}
