import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import { EmailTemplate } from './interfaces/email-template.interface';
import { EmailOptions } from './interfaces/email-options.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    this.transporter = nodemailer.createTransport({
      service: this.configService.get('EMAIL_SERVICE'),
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASSWORD'),
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.emailQueue.add('send-email', options, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const template = this.getTemplate('verification', {
      verificationLink: `${this.configService.get('FRONTEND_URL')}/verify-email/${token}`,
    });

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html: template.html,
      text: template.text,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const template = this.getTemplate('passwordReset', {
      resetLink: `${this.configService.get('FRONTEND_URL')}/reset-password/${token}`,
    });

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html: template.html,
      text: template.text,
    });
  }

  async sendAppointmentConfirmation(
    email: string,
    appointmentDetails: any,
  ): Promise<void> {
    const template = this.getTemplate(
      'appointmentConfirmation',
      appointmentDetails,
    );

    await this.sendEmail({
      to: email,
      subject: 'Appointment Confirmation',
      html: template.html,
      text: template.text,
    });
  }

  private getTemplate(name: string, data: any): EmailTemplate {
    const templates = {
      verification: {
        html: `
          <h1>Welcome to Tailor Platform!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${data.verificationLink}">${data.verificationLink}</a>
          <p>This link will expire in 24 hours.</p>
        `,
        text: `
          Welcome to Tailor Platform!
          Please verify your email address by clicking the link below:
          ${data.verificationLink}
          This link will expire in 24 hours.
        `,
      },
      passwordReset: {
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested to reset your password. Click the link below to proceed:</p>
          <a href="${data.resetLink}">${data.resetLink}</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
        text: `
          Password Reset Request
          You requested to reset your password. Click the link below to proceed:
          ${data.resetLink}
          This link will expire in 1 hour.
          If you didn't request this, please ignore this email.
        `,
      },
      appointmentConfirmation: {
        html: `
          <h1>Appointment Confirmed</h1>
          <p>Your appointment has been scheduled for:</p>
          <p>Date: ${data.date}</p>
          <p>Time: ${data.time}</p>
          <p>Tailor: ${data.tailorName}</p>
          <p>Location: ${data.location}</p>
          <p>Service: ${data.service}</p>
        `,
        text: `
          Appointment Confirmed
          Your appointment has been scheduled for:
          Date: ${data.date}
          Time: ${data.time}
          Tailor: ${data.tailorName}
          Location: ${data.location}
          Service: ${data.service}
        `,
      },
    };

    return templates[name];
  }
}
