// /backend/src/email/email.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { EmailOptions } from './interfaces/email-options.interface';

interface EmailConfig {
  service: string;
  auth: {
    user: string;
    pass: string;
  };
}

interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const emailConfig: EmailConfig = {
      service: this.configService.get<string>('EMAIL_SERVICE') ?? '',
      auth: {
        user: this.configService.get<string>('EMAIL_USER') ?? '',
        pass: this.configService.get<string>('EMAIL_PASSWORD') ?? '',
      },
    };

    this.transporter = nodemailer.createTransport(emailConfig);
  }

  @Process('send-email')
  async handleSendEmail(job: Job<EmailOptions>): Promise<void> {
    try {
      const { to, subject, html, text } = job.data;

      const mailOptions: SendMailOptions = {
        from: this.configService.get<string>('EMAIL_FROM') ?? '',
        to,
        subject,
        html,
        text,
      };

      await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }
}