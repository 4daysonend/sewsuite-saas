import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import { TemplateService } from './template.service';
import { EmailOptions } from '../interfaces/email-options.interface';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
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

  private async queueEmail(options: EmailOptions): Promise<void> {
    try {
      await this.emailQueue.add('send-email', options, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      });
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`);
      throw error;
    }
  }

  // Order Notifications
  async sendOrderCreationNotification(
    user: User,
    orderData: {
      orderId: string;
      totalAmount: number;
      tailorName: string;
      orderDetails: any;
    },
  ): Promise<void> {
    const { html, text } = await this.templateService.renderTemplate(
      'orderCreation',
      {
        clientName: `${user.firstName} ${user.lastName}`,
        ...orderData,
        orderUrl: `${this.configService.get('FRONTEND_URL')}/orders/${orderData.orderId}`,
      },
      user.locale,
    );

    await this.queueEmail({
      to: user.email,
      subject: 'Order Confirmation',
      html,
      text,
    });
  }

  async sendOrderStatusUpdate(
    user: User,
    updateData: {
      orderId: string;
      oldStatus: string;
      newStatus: string;
      notes?: string;
    },
  ): Promise<void> {
    const { html, text } = await this.templateService.renderTemplate(
      'orderStatusUpdate',
      {
        clientName: `${user.firstName} ${user.lastName}`,
        ...updateData,
        orderUrl: `${this.configService.get('FRONTEND_URL')}/orders/${updateData.orderId}`,
      },
      user.locale,
    );

    await this.queueEmail({
      to: user.email,
      subject: `Order Status Update: ${updateData.newStatus}`,
      html,
      text,
    });
  }

  async sendFittingReminder(
    user: User,
    fittingData: {
      orderId: string;
      fittingDate: Date;
      location: string;
      notes?: string;
    },
  ): Promise<void> {
    const { html, text } = await this.templateService.renderTemplate(
      'fittingReminder',
      {
        clientName: `${user.firstName} ${user.lastName}`,
        ...fittingData,
        calendarUrl: this.generateCalendarUrl(fittingData),
      },
      user.locale,
    );

    await this.queueEmail({
      to: user.email,
      subject: 'Upcoming Fitting Appointment Reminder',
      html,
      text,
    });
  }

  // Payment Notifications
  async sendPaymentConfirmation(
    user: User,
    paymentData: {
      orderId: string;
      amount: number;
      transactionId: string;
      paymentDate: Date;
    },
  ): Promise<void> {
    const { html, text } = await this.templateService.renderTemplate(
      'paymentConfirmation',
      {
        clientName: `${user.firstName} ${user.lastName}`,
        ...paymentData,
        orderUrl: `${this.configService.get('FRONTEND_URL')}/orders/${paymentData.orderId}`,
      },
      user.locale,
    );

    await this.queueEmail({
      to: user.email,
      subject: 'Payment Confirmation',
      html,
      text,
    });
  }

  async sendPaymentFailureNotification(
    user: User,
    paymentData: {
      orderId: string;
      amount: number;
      failureReason: string;
    },
  ): Promise<void> {
    const { html, text } = await this.templateService.renderTemplate(
      'paymentFailed',
      {
        clientName: `${user.firstName} ${user.lastName}`,
        ...paymentData,
        paymentUrl: `${this.configService.get('FRONTEND_URL')}/orders/${paymentData.orderId}/payment`,
      },
      user.locale,
    );

    await this.queueEmail({
      to: user.email,
      subject: 'Payment Failed',
      html,
      text,
      priority: 'high',
    });
  }

  // File Upload Notifications
  async sendFileUploadConfirmation(
    user: User,
    fileData: {
      fileId: string;
      fileName: string;
      fileType: string;
      orderId?: string;
    },
  ): Promise<void> {
    const { html, text } = await this.templateService.renderTemplate(
      'fileUploadConfirmation',
      {
        clientName: `${user.firstName} ${user.lastName}`,
        ...fileData,
        fileUrl: `${this.configService.get('FRONTEND_URL')}/files/${fileData.fileId}`,
      },
      user.locale,
    );

    await this.queueEmail({
      to: user.email,
      subject: 'File Upload Confirmation',
      html,
      text,
    });
  }

  // Utility Methods
  private generateCalendarUrl(fittingData: {
    fittingDate: Date;
    location: string;
    notes?: string;
  }): string {
    const event = {
      text: 'Fitting Appointment - Tailor Platform',
      dates: fittingData.fittingDate.toISOString(),
      location: fittingData.location,
      details: fittingData.notes || 'Fitting appointment for your order',
    };

    return `${this.configService.get('FRONTEND_URL')}/calendar/add?${new URLSearchParams(
      event as any,
    ).toString()}`;
  }
}
