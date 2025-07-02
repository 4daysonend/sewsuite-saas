import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gauge, Registry } from 'prom-client';
import * as nodemailer from 'nodemailer';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SmtpHealthCollector {
  private readonly logger = new Logger(SmtpHealthCollector.name);
  private readonly smtpUp: Gauge<string>;
  private readonly lastSuccessfulConnection: Gauge<string>;
  private readonly smtpServer: string | undefined;
  private readonly smtpUser: string | undefined;
  private readonly smtpPass: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    registry: Registry,
  ) {
    // Initialize metrics
    this.smtpUp = new Gauge({
      name: 'smtp_up',
      help: 'Indicates if the SMTP server is reachable (1: up, 0: down)',
      registers: [registry],
    });

    this.lastSuccessfulConnection = new Gauge({
      name: 'smtp_last_successful_connection_timestamp',
      help: 'Timestamp of the last successful connection to the SMTP server',
      registers: [registry],
    });

    // Get SMTP configuration
    this.smtpServer = this.configService.get<string>('SMTP_SERVER');
    this.smtpUser = this.configService.get<string>('SMTP_USER');
    this.smtpPass = this.configService.get<string>('SMTP_PASS');

    // Initialize with default values
    this.smtpUp.set(0);
    this.lastSuccessfulConnection.set(0);

    // Log configuration status
    if (!this.smtpServer) {
      this.logger.warn(
        'SMTP_SERVER not configured, health monitoring disabled',
      );
    }
  }

  /**
   * Check SMTP server connectivity every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSmtpHealth() {
    if (!this.smtpServer) {
      return; // Skip check if not configured
    }

    try {
      this.logger.debug(`Checking SMTP server health: ${this.smtpServer}`);

      const transporter = nodemailer.createTransport({
        host: this.smtpServer,
        port: this.configService.get<number>('SMTP_PORT') || 587,
        secure: this.configService.get<boolean>('SMTP_SECURE') || false,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
        connectionTimeout: 5000, // 5 seconds timeout
        logger: false, // Disable verbose logging
      });

      // Verify connection
      const isVerified = await transporter.verify();

      if (isVerified) {
        this.smtpUp.set(1);
        this.lastSuccessfulConnection.set(Date.now() / 1000); // Unix timestamp in seconds
        this.logger.debug('SMTP server is reachable');
      } else {
        this.smtpUp.set(0);
        this.logger.warn('SMTP server verification failed');
      }
    } catch (error) {
      this.smtpUp.set(0);
      this.logger.error(
        `SMTP health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
