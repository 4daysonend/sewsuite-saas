import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Registry, Gauge, Counter, Histogram } from 'prom-client';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class BullQueueCollector {
  private readonly logger = new Logger(BullQueueCollector.name);

  // Queue metrics
  private readonly waitingCountGauge: Gauge<string>;
  private readonly activeCountGauge: Gauge<string>;
  private readonly completedCountGauge: Gauge<string>;
  private readonly failedCountGauge: Gauge<string>;
  private readonly delayedCountGauge: Gauge<string>;

  // Job processing metrics
  private readonly jobCompletedCounter: Counter<string>;
  private readonly jobFailedCounter: Counter<string>;
  private readonly jobDurationHistogram: Histogram<string>;

  // Business metrics
  private readonly paymentConfirmationEmailsFailedCounter: Counter<string>;

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('email-dlq') private readonly emailDlqQueue: Queue,
    registry: Registry,
  ) {
    // Queue size metrics
    this.waitingCountGauge = new Gauge({
      name: 'bull_queue_waiting_count',
      help: 'Number of jobs waiting in the queue',
      labelNames: ['queue'],
      registers: [registry],
    });

    this.activeCountGauge = new Gauge({
      name: 'bull_queue_active_count',
      help: 'Number of jobs actively being processed',
      labelNames: ['queue'],
      registers: [registry],
    });

    this.completedCountGauge = new Gauge({
      name: 'bull_queue_completed_count',
      help: 'Number of jobs completed successfully',
      labelNames: ['queue'],
      registers: [registry],
    });

    this.failedCountGauge = new Gauge({
      name: 'bull_queue_failed_count',
      help: 'Number of jobs that have failed',
      labelNames: ['queue'],
      registers: [registry],
    });

    this.delayedCountGauge = new Gauge({
      name: 'bull_queue_delayed_count',
      help: 'Number of jobs delayed for future processing',
      labelNames: ['queue'],
      registers: [registry],
    });

    // Job processing metrics
    this.jobCompletedCounter = new Counter({
      name: 'bull_job_completed_count',
      help: 'Number of jobs completed',
      labelNames: ['queue', 'job_type'],
      registers: [registry],
    });

    this.jobFailedCounter = new Counter({
      name: 'bull_job_failed_count',
      help: 'Number of jobs failed',
      labelNames: ['queue', 'job_type', 'error_type'],
      registers: [registry],
    });

    this.jobDurationHistogram = new Histogram({
      name: 'bull_job_duration_seconds',
      help: 'Duration of job processing in seconds',
      labelNames: ['queue', 'job_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [registry],
    });

    // Business metrics
    this.paymentConfirmationEmailsFailedCounter = new Counter({
      name: 'payment_confirmation_emails_failed_total',
      help: 'Number of payment confirmation emails that failed to send',
      registers: [registry],
    });

    // Register for Bull events to track metrics
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen to job completion
    this.emailQueue.on('completed', (job, _result) => {
      const jobType = job.name || 'unknown';

      // Increment completed counter
      this.jobCompletedCounter.inc({
        queue: 'email',
        job_type: jobType,
      });

      // Record job duration
      const processingTime =
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : 0;
      if (processingTime > 0) {
        this.jobDurationHistogram.observe(
          {
            queue: 'email',
            job_type: jobType,
          },
          processingTime / 1000,
        );
      }
    });

    // Listen to job failures
    this.emailQueue.on('failed', (job, error) => {
      const jobType = job.name || 'unknown';
      let errorType = 'unknown';

      // Try to categorize the error
      if (error) {
        // Handle network errors that might have a code property
        const networkError = error as any;
        if (
          networkError.code === 'ECONNREFUSED' ||
          networkError.code === 'ETIMEDOUT'
        ) {
          errorType = 'connection';
        } else if (
          networkError.responseCode >= 400 &&
          networkError.responseCode < 500
        ) {
          errorType = 'client_error';
        } else if (networkError.responseCode >= 500) {
          errorType = 'server_error';
        } else {
          errorType = 'runtime_error';
        }
      }

      // Increment failed counter
      this.jobFailedCounter.inc({
        queue: 'email',
        job_type: jobType,
        error_type: errorType,
      });

      // Increment business metrics if this is a payment confirmation email
      if (jobType === 'payment-confirmation') {
        this.paymentConfirmationEmailsFailedCounter.inc();
      }
    });

    // Same for DLQ
    this.emailDlqQueue.on('completed', (job) => {
      this.logger.warn(`Job in DLQ was processed: ${job.id}`);
    });

    this.emailDlqQueue.on('failed', (job, error) => {
      this.logger.error(`Job in DLQ failed: ${job.id}`, error.stack);
    });
  }

  /**
   * Collect queue metrics every 15 seconds
   */
  @Interval(15000)
  async collectQueueMetrics() {
    try {
      // Email queue metrics
      const [
        emailWaiting,
        emailActive,
        emailCompleted,
        emailFailed,
        emailDelayed,
      ] = await Promise.all([
        this.emailQueue.getWaitingCount(),
        this.emailQueue.getActiveCount(),
        this.emailQueue.getCompletedCount(),
        this.emailQueue.getFailedCount(),
        this.emailQueue.getDelayedCount(),
      ]);

      this.waitingCountGauge.set({ queue: 'email' }, emailWaiting);
      this.activeCountGauge.set({ queue: 'email' }, emailActive);
      this.completedCountGauge.set({ queue: 'email' }, emailCompleted);
      this.failedCountGauge.set({ queue: 'email' }, emailFailed);
      this.delayedCountGauge.set({ queue: 'email' }, emailDelayed);

      // Email DLQ metrics
      const [dlqWaiting, dlqActive, dlqCompleted, dlqFailed] =
        await Promise.all([
          this.emailDlqQueue.getWaitingCount(),
          this.emailDlqQueue.getActiveCount(),
          this.emailDlqQueue.getCompletedCount(),
          this.emailDlqQueue.getFailedCount(),
        ]);

      this.waitingCountGauge.set({ queue: 'email-dlq' }, dlqWaiting);
      this.activeCountGauge.set({ queue: 'email-dlq' }, dlqActive);
      this.completedCountGauge.set({ queue: 'email-dlq' }, dlqCompleted);
      this.failedCountGauge.set({ queue: 'email-dlq' }, dlqFailed);

      if (dlqWaiting > 0) {
        this.logger.warn(`Email DLQ has ${dlqWaiting} waiting jobs`);
      }
    } catch (error) {
      this.logger.error(
        `Error collecting queue metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
