// /backend/src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  context?: Record<string, any>;
}

interface PaymentEmailData {
  orderId: string;
  amount: number;
  date?: Date;
  customerName?: string;
  productDetails?: {
    name: string;
    quantity: number;
    price: number;
  }[];
}

// Update the interface to require the email, subscriptionId, and plan properties
interface SubscriptionEmailData {
  email: string; // Required, non-optional
  subscriptionId: string; // Required, non-optional
  plan: string; // Required, non-optional
  customerName?: string;
  startDate?: Date;
  endDate?: Date;
  amount?: number;
  billingCycle?: string;
  features?: string[];
  reason?: string;
}

// Update the function to validate required fields
function createSubscriptionEmailData(
  email: string | undefined,
  subscriptionId: string | undefined,
  plan: string | undefined,
  options: {
    customerName?: string;
    startDate?: Date;
    endDate?: Date;
    amount?: number;
    billingCycle?: string;
    features?: string[];
    reason?: string;
  } = {},
): SubscriptionEmailData {
  // Validate required parameters
  if (!email) throw new Error('Email is required for subscription emails');
  if (!subscriptionId)
    throw new Error('Subscription ID is required for subscription emails');
  if (!plan) throw new Error('Plan is required for subscription emails');

  // Now TypeScript knows these variables can't be undefined
  return {
    email, // Now guaranteed to be string, not string | undefined
    subscriptionId, // Now guaranteed to be string, not string | undefined
    plan, // Now guaranteed to be string, not string | undefined
    ...options,
  };
}

interface EmailError extends Error {
  code?: string;
  responseCode?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly smtpServer: string;
  private readonly smtpUser: string;
  private readonly smtpPass: string;
  private readonly senderEmail: string;
  private readonly templateDir: string;
  private readonly templates: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private emailEnabled = true;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {
    try {
      // Get configuration
      this.smtpServer = this.configService.get<string>('SMTP_SERVER') || '';
      this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
      this.smtpPass = this.configService.get<string>('SMTP_PASS') || '';
      this.senderEmail = this.configService.get<string>('SENDER_EMAIL') || '';
      this.maxRetries = this.configService.get<number>('EMAIL_MAX_RETRIES', 3);

      // Validate critical configuration
      if (!this.smtpServer) {
        this.logger.warn(
          'SMTP_SERVER not configured, email sending will be disabled',
        );
        this.emailEnabled = false;
      }

      if (!this.smtpUser || !this.smtpPass) {
        this.logger.warn(
          'SMTP credentials not configured, email sending will be disabled',
        );
        this.emailEnabled = false;
      }

      // Use defaults only after logging warnings
      this.smtpServer = this.smtpServer || 'localhost';
      this.senderEmail = this.senderEmail || 'noreply@example.com';

      // Load templates
      this.templateDir = path.join(process.cwd(), 'src/email/templates');

      // Verify SMTP connection on startup
      this.verifySMTPConnection();

      // Load templates asynchronously with better error handling
      this.loadTemplates().catch((error) => {
        this.logger.error(
          `Failed to load email templates: ${error.message}`,
          error.stack,
        );

        // Emit event for monitoring systems
        this.eventEmitter.emit('email.templates.loadingFailed', {
          error: error.message,
          timestamp: new Date(),
        });
      });
    } catch (error) {
      // Handle initialization errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error initializing EmailService: ${errorMessage}`,
        errorStack,
      );

      // Set reasonable defaults even in case of initialization failure
      this.smtpServer = this.smtpServer || 'localhost';
      this.senderEmail = this.senderEmail || 'noreply@example.com';
      this.emailEnabled = false;

      // Emit event for monitoring
      this.eventEmitter.emit('email.service.initializationFailed', {
        error: errorMessage,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Verify SMTP connection on service initialization
   */
  private async verifySMTPConnection(): Promise<void> {
    try {
      if (!this.emailEnabled) {
        this.logger.warn('Email sending disabled, skipping SMTP verification');
        return;
      }

      const verified = await this.verifySmtpConnection();

      if (!verified) {
        this.logger.warn(
          'SMTP connection verification failed, emails may not be delivered',
        );

        // Emit event for monitoring systems
        this.eventEmitter.emit('email.smtp.connectionFailed', {
          timestamp: new Date(),
        });
      } else {
        this.logger.log('SMTP connection verified successfully');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error verifying SMTP connection: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Load email templates from the templates directory
   */
  private async loadTemplates(): Promise<void> {
    try {
      // Ensure directory exists
      try {
        await fs.access(this.templateDir);
      } catch {
        this.logger.warn(
          `Email templates directory not found at: ${this.templateDir}`,
        );
        return;
      }

      // Read all template files
      const files = await fs.readdir(this.templateDir);
      const htmlTemplates = files.filter((file) => file.endsWith('.html'));

      // Compile each template
      for (const file of htmlTemplates) {
        try {
          const templateName = path.basename(file, '.html');
          const templateContent = await fs.readFile(
            path.join(this.templateDir, file),
            'utf8',
          );
          const compiledTemplate = Handlebars.compile(templateContent);
          this.templates.set(templateName, compiledTemplate);
          this.logger.log(`Loaded email template: ${templateName}`);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to load template ${file}: ${errorMessage}`);
        }
      }

      this.logger.log(`Loaded ${this.templates.size} email templates`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error loading email templates: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get HTML content from a template
   */
  private getTemplateContent(
    template: string,
    context: Record<string, any>,
  ): string | null {
    const compiledTemplate = this.templates.get(template);

    if (!compiledTemplate) {
      this.logger.warn(`Template not found: ${template}`);
      return null;
    }

    try {
      return compiledTemplate(context);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error rendering template ${template}: ${errorMessage}`,
      );
      return null;
    }
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Create a nodemailer transporter
   */
  private createTransporter() {
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);

    return nodemailer.createTransport({
      host: this.smtpServer,
      port: port,
      secure: secure,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
      connectionTimeout: this.configService.get<number>(
        'SMTP_CONN_TIMEOUT',
        5000,
      ),
      greetingTimeout: this.configService.get<number>(
        'SMTP_GREETING_TIMEOUT',
        5000,
      ),
      socketTimeout: this.configService.get<number>(
        'SMTP_SOCKET_TIMEOUT',
        10000,
      ),
    });
  }

  /**
   * Send an email using the configured SMTP server
   * Enhanced with better error handling and retry logic
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    // Start tracking metrics
    const startTime = Date.now();
    const correlationId = `email-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      this.logger.log(
        `[${correlationId}] Sending email to ${options.to}: ${options.subject}`,
      );

      // Check if email service is enabled
      if (!this.emailEnabled) {
        throw new Error('Email service is not enabled');
      }

      // Handle template rendering if template is specified
      if (options.template && options.context) {
        const html = this.getTemplateContent(options.template, options.context);
        if (html) {
          options.html = html;
          // Generate text version if not provided
          if (!options.text) {
            options.text = this.htmlToText(html);
          }
        }
      }

      // Validate that we have content to send
      if (!options.html && !options.text) {
        throw new Error('No email content (html or text) provided');
      }

      const transporter = this.createTransporter();

      // Try sending the email
      await transporter.sendMail({
        from: this.senderEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        messageId: `<${correlationId}@sewsuite.com>`,
      });

      // Track metrics for successful delivery
      const processingTime = Date.now() - startTime;

      this.logger.log(
        `[${correlationId}] Email sent successfully to ${options.to} in ${processingTime}ms`,
      );

      // Emit success metrics
      this.eventEmitter.emit('email.sent', {
        recipient: options.to,
        subject: options.subject,
        messageId: correlationId,
        processingTime,
        timestamp: new Date(),
      });
    } catch (error) {
      const emailError = error as EmailError;
      const processingTime = Date.now() - startTime;

      // Enhanced error logging with more context
      this.logger.error(
        `[${correlationId}] Failed to send email to ${options.to}: ${emailError.message}`,
        emailError.stack,
      );

      // Additional logging for SMTP-specific errors
      if (emailError.code) {
        this.logger.error(
          `[${correlationId}] SMTP Error Code: ${emailError.code}`,
        );
      }

      // Emit failure metrics
      this.eventEmitter.emit('email.failed', {
        recipient: options.to,
        subject: options.subject,
        messageId: correlationId,
        processingTime,
        error: emailError.message,
        errorCode: emailError.code,
        timestamp: new Date(),
      });

      // Check if this is a transient error that should be retried
      const isRetryableError = this.isRetryableError(emailError);

      if (isRetryableError) {
        try {
          // Queue for retry with exponential backoff
          await this.queueForRetry({
            ...options,
            _metadata: {
              correlationId,
              attempt: 1,
              maxAttempts: this.maxRetries,
            },
          });

          this.logger.log(`[${correlationId}] Email queued for retry`);
        } catch (queueError) {
          this.logger.error(
            `[${correlationId}] Failed to queue email for retry: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
            queueError instanceof Error ? queueError.stack : undefined,
          );
        }
      }

      // Re-throw the error for the caller to handle
      throw emailError;
    }
  }

  /**
   * Determine if an email error is retryable
   */
  private isRetryableError(error: EmailError): boolean {
    // SMTP connection errors are usually transient
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND'
    ) {
      return true;
    }

    // Certain SMTP response codes indicate temporary failures
    if (error.responseCode) {
      // 4xx errors are temporary
      return error.responseCode >= 400 && error.responseCode < 500;
    }

    return false;
  }

  /**
   * Queue an email for retry
   */
  private async queueForRetry(
    options: EmailOptions & {
      _metadata: {
        correlationId: string;
        attempt: number;
        maxAttempts: number;
      };
    },
  ): Promise<void> {
    try {
      // Add to retry queue with exponential backoff
      const backoffDelay = Math.pow(2, options._metadata.attempt) * 1000; // exponential backoff

      await this.emailQueue.add('retry-email', options, {
        delay: backoffDelay,
        attempts: options._metadata.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to queue email retry: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Verify SMTP connection
   */
  private async verifySmtpConnection(): Promise<boolean> {
    if (!this.emailEnabled) {
      return false;
    }

    try {
      const transporter = this.createTransporter();
      await transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error(
        `SMTP connection verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Send a payment confirmation email
   */
  async sendOrderPaymentConfirmation(
    email: string,
    data: PaymentEmailData,
  ): Promise<void> {
    try {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(data.amount);

      // Try to use the template first
      const emailContent: EmailOptions = {
        to: email,
        subject: 'Payment Confirmation',
        template: 'payment-confirmation',
        context: {
          orderId: data.orderId,
          amount: formattedAmount,
          date:
            data.date?.toLocaleDateString() || new Date().toLocaleDateString(),
          customerName: data.customerName || 'Valued Customer',
          productDetails: data.productDetails || [],
          hasProductDetails:
            Array.isArray(data.productDetails) &&
            data.productDetails.length > 0,
        },
      };

      // Fallback HTML if template loading fails
      if (!this.templates.has('payment-confirmation')) {
        emailContent.html = `
          <h1>Payment Confirmed</h1>
          <p>Dear ${data.customerName || 'Valued Customer'},</p>
          <p>Payment for order #${data.orderId} has been processed successfully.</p>
          <p>Amount: ${formattedAmount}</p>
          ${data.date ? `<p>Date: ${data.date.toLocaleDateString()}</p>` : ''}
          ${
            data.productDetails && data.productDetails.length > 0
              ? `
            <h2>Order Details</h2>
            <ul>
              ${data.productDetails
                .map(
                  (item) => `
                <li>${item.name} (${item.quantity} × $${item.price.toFixed(2)})</li>
              `,
                )
                .join('')}
            </ul>
          `
              : ''
          }
          <p>Thank you for your business!</p>
        `;

        emailContent.text = `
          Payment Confirmed
          
          Dear ${data.customerName || 'Valued Customer'},
          
          Payment for order #${data.orderId} has been processed successfully.
          Amount: ${formattedAmount}
          ${data.date ? `Date: ${data.date.toLocaleDateString()}` : ''}
          
          ${
            data.productDetails && data.productDetails.length > 0
              ? `
            Order Details:
            ${data.productDetails.map((item) => `- ${item.name} (${item.quantity} × $${item.price.toFixed(2)})`).join('\n')}
          `
              : ''
          }
          
          Thank you for your business!
        `.trim();
      }

      await this.sendEmail(emailContent);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(
        `Failed to send payment confirmation email to ${email} for order ${data.orderId}: ${emailError.message}`,
      );

      // We might want to queue the email for retry rather than throwing
      // For now, re-throw the error
      throw emailError;
    }
  }

  /**
   * Send a payment failure notification
   */
  async sendOrderPaymentFailedNotification(
    email: string,
    data: PaymentEmailData,
  ): Promise<void> {
    try {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(data.amount);

      const emailContent: EmailOptions = {
        to: email,
        subject: 'Payment Failed',
        template: 'payment-failed',
        context: {
          orderId: data.orderId,
          amount: formattedAmount,
          date:
            data.date?.toLocaleDateString() || new Date().toLocaleDateString(),
          customerName: data.customerName || 'Valued Customer',
        },
      };

      // Fallback if template not available
      if (!this.templates.has('payment-failed')) {
        emailContent.html = `
          <h1>Payment Failed</h1>
          <p>Dear ${data.customerName || 'Valued Customer'},</p>
          <p>Payment for order #${data.orderId} could not be processed.</p>
          <p>Amount: ${formattedAmount}</p>
          <p>Please check your payment information and try again, or contact our support team for assistance.</p>
        `;

        emailContent.text = `
          Payment Failed
          
          Dear ${data.customerName || 'Valued Customer'},
          
          Payment for order #${data.orderId} could not be processed.
          Amount: ${formattedAmount}
          
          Please check your payment information and try again, or contact our support team for assistance.
        `.trim();
      }

      await this.sendEmail(emailContent);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(
        `Failed to send payment failed notification to ${email} for order ${data.orderId}: ${emailError.message}`,
      );
      throw emailError;
    }
  }

  /**
   * Send a subscription confirmation email
   */
  async sendSubscriptionConfirmation(
    email: string,
    subscriptionId: string,
    plan: string,
    options: { startDate: Date; customerName?: string },
  ): Promise<void> {
    const subscriptionData = createSubscriptionEmailData(
      email,
      subscriptionId,
      plan,
      {
        startDate: options.startDate,
        customerName: options.customerName,
      },
    );

    await this.sendEmail({
      to: subscriptionData.email,
      subject: `Subscription Confirmation: ${subscriptionData.plan}`,
      template: 'subscription-confirmation',
      context: subscriptionData,
    });
  }

  /**
   * Send a subscription cancellation email
   */
  async sendSubscriptionCancellation(
    data: SubscriptionEmailData,
  ): Promise<void> {
    try {
      // Validate required fields
      if (!data.endDate) {
        throw new Error(
          'endDate is required for subscription cancellation emails',
        );
      }

      const emailContent: EmailOptions = {
        to: data.email,
        subject: 'Subscription Cancellation Confirmation',
        template: 'subscription-cancellation',
        context: {
          subscriptionId: data.subscriptionId,
          plan: data.plan,
          endDate: data.endDate.toLocaleDateString(),
          customerName: data.customerName || 'Valued Customer',
          reason: data.reason,
          hasReason: !!data.reason,
        },
      };

      // Fallback if template not available
      if (!this.templates.has('subscription-cancellation')) {
        emailContent.html = `
          <h1>Subscription Cancellation Confirmation</h1>
          <p>Dear ${data.customerName || 'Valued Customer'},</p>
          <p>Your subscription (ID: ${data.subscriptionId}) has been canceled.</p>
          <p>Plan: ${data.plan}</p>
          <p>End Date: ${data.endDate.toLocaleDateString()}</p>
          ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
          <p>We're sorry to see you go. If you change your mind, you can resubscribe at any time.</p>
          <p>Thank you for being our customer!</p>
        `;

        emailContent.text = `
          Subscription Cancellation Confirmation
          
          Dear ${data.customerName || 'Valued Customer'},
          
          Your subscription (ID: ${data.subscriptionId}) has been canceled.
          Plan: ${data.plan}
          End Date: ${data.endDate.toLocaleDateString()}
          ${data.reason ? `Reason: ${data.reason}` : ''}
          
          We're sorry to see you go. If you change your mind, you can resubscribe at any time.
          
          Thank you for being our customer!
        `.trim();
      }

      await this.sendEmail(emailContent);
    } catch (error) {
      const emailError = error as EmailError;
      this.logger.error(
        `Failed to send subscription cancellation email to ${data.email} for subscription ${data.subscriptionId}: ${emailError.message}`,
      );
      throw emailError;
    }
  }

  /**
   * Generate content for test emails
   * @param timestamp Timestamp to include in the email
   * @returns Object containing HTML and plain text versions of the email
   */
  public generateTestEmailContent(timestamp: string): {
    html: string;
    text: string;
  } {
    return {
      html: `<h1>Test Email</h1>
             <p>This is a test email from SewSuite Platform.</p>
             <p>Sent at: ${timestamp}</p>
             <p>This email is for testing purposes only.</p>`,
      text: `Test Email

This is a test email from SewSuite Platform.
Sent at: ${timestamp}
This email is for testing purposes only.`,
    };
  }
}
