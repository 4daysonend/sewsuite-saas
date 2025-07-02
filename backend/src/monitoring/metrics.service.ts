import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: client.Registry;

  // Job metrics
  private readonly jobExecutions = new client.Counter({
    name: 'job_executions_total',
    help: 'Number of job executions',
    labelNames: ['job_name', 'outcome'],
  });

  private readonly jobDuration = new client.Histogram({
    name: 'job_execution_duration_seconds',
    help: 'Duration of job executions in seconds',
    labelNames: ['job_name'],
    buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10, 30, 60],
  });

  constructor() {
    // Create a custom registry for our metrics
    this.registry = new client.Registry();

    // Register our custom metrics
    this.registry.registerMetric(this.jobExecutions);
    this.registry.registerMetric(this.jobDuration);

    // Other constructor logic...
  }

  onModuleInit() {
    // Initialize the prometheus client with our registry
    const collectDefaultMetrics = client.collectDefaultMetrics;
    collectDefaultMetrics({
      prefix: 'node_',
      register: this.registry,
    });

    this.logger.log('Prometheus metrics initialized');
  }

  /**
   * Collect queue metrics from all collectors
   */
  async collectQueueMetrics(): Promise<string> {
    try {
      // The actual metrics are collected by BullQueueCollector automatically
      // We just return the current metrics registry content
      return await this.registry.metrics();
    } catch (error) {
      this.logger.error(
        `Error collecting queue metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return `# Error collecting metrics: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Collect health check metrics
   */
  async collectHealthMetrics(): Promise<string> {
    try {
      // The actual metrics are collected by SmtpHealthCollector automatically
      // We just return the current metrics registry content
      return await this.registry.metrics();
    } catch (error) {
      this.logger.error(
        `Error collecting health metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return `# Error collecting metrics: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Record custom job execution metrics
   */
  recordJobExecution(jobName: string, success: boolean, duration: number) {
    try {
      // Record job execution count by name and outcome
      this.jobExecutions
        .labels({
          job_name: jobName,
          outcome: success ? 'success' : 'failure',
        })
        .inc();

      // Record job execution duration (convert to seconds if in milliseconds)
      const durationSeconds = duration > 1000 ? duration / 1000 : duration;
      this.jobDuration.labels({ job_name: jobName }).observe(durationSeconds);

      this.logger.debug(`Recorded job metrics for ${jobName}`, {
        success,
        durationSeconds,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record job metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Get the metrics registry
   */
  getRegistry() {
    return this.registry;
  }
}
