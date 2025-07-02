import { Injectable, Logger } from '@nestjs/common';
import { HealthStatus } from './health.service'; // Add this line
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from '@nestjs-modules/mailer';
import { HealthService } from './health.service';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { RecoveryService } from './recovery.service';
import { RecoveryResult } from './recovery.service';

interface Thresholds {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  queueLength: number;
  errorRate: number;
}

interface WorkerMetrics {
  cpu: number;
}

interface Metrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    api?: {
      responseTime: number;
      historicalResponseTime: number[];
      errorRate: number;
      historicalErrorRate: number[];
    };
    performance?: {
      cpu: number;
      memory: number;
      disk: number;
    };
    loadAverage: number;
    timestamp: string;
  };
  timestamp: string;
}

// Removed unused MetricsSummary interface

// Removed unused QueuePattern interface

interface QueueMetrics {
  waiting: number;
  errorRate: number;
}

// Removed duplicate ErrorPattern interface definition

// Removed unused Issue interface

interface ErrorPattern {
  type: string;
  message: string;
  count: number;
  significance: number;
  isSystematic: boolean; // Add this line
  isRetryable: boolean; // Add this line
}

interface Anomaly {
  type: string;
  current: number;
  historical: number[];
}

@Injectable()
class LocalEmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
    });
  }

  async sendAdminReport(report: string): Promise<void> {
    await this.mailerService.sendMail({
      to: 'admin@example.com',
      subject: 'Daily System Health Report',
      template: 'report-template',
      context: { report },
    });
  }
}

@Injectable()
export class ProactiveMonitoringService {
  private readonly logger = new Logger(ProactiveMonitoringService.name);

  private thresholds: Thresholds = {
    cpuUsage: 80,
    memoryUsage: 80,
    diskUsage: 80,
    queueLength: 100,
    errorRate: 5,
  };

  async monitor(): Promise<void> {
    // Example monitoring logic
    const issues = await this.checkForIssues();
    if (issues.length > 0) {
      await this.emailService.sendEmail(
        'admin@example.com',
        'Monitoring Alert',
        'alert-template',
        { issues },
      );
      this.logger.log('Alert email sent');
    }
  }

  private async checkForIssues(): Promise<string[]> {
    // Example issue checking logic
    return ['Issue 1', 'Issue 2'];
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSystemHealth(): Promise<void> {
    try {
      const healthStatus: HealthStatus = await this.healthService.checkHealth();

      if (healthStatus.status !== 'healthy') {
        await this.handleDegradation(healthStatus);
      }

      await this.checkResourceUsage();
      await this.checkQueueHealth();
      await this.analyzeErrorPatterns();
    } catch (error) {
      this.logger.error(`Health check failed: ${(error as Error).message}`);
    }
  }

  private async generateSystemHealthReport(): Promise<string> {
    // Implement the logic to generate the system health report
    return 'System Health Report';
  }
  @Cron(CronExpression.EVERY_10_MINUTES)
  async performanceAnalysis(): Promise<void> {
    try {
      const metricsSummary: {
        status: string;
        metrics: {
          cpu: number;
          memory: number;
          loadAverage: number;
          timestamp: string;
          disk?: number; // Make disk optional
        };
        timestamp: string;
      } = await this.monitoringService.getMetricsSummary();
      const metrics: Metrics = {
        status: metricsSummary.status as 'healthy' | 'degraded' | 'unhealthy',
        metrics: {
          cpu: metricsSummary.metrics.cpu,
          memory: metricsSummary.metrics.memory,
          disk: metricsSummary.metrics.disk ?? 0, // Ensure disk is included
          loadAverage: metricsSummary.metrics.loadAverage,
          timestamp: metricsSummary.metrics.timestamp,
        },
        timestamp: metricsSummary.timestamp,
      };
      await this.detectAnomalies(metrics);
      await this.predictResourceNeeds(metrics);
      await this.optimizeResourceAllocation();
    } catch (error) {
      this.logger.error(
        `Performance analysis failed: ${(error as Error).message}`,
      );
    }
  }

  private async handleDegradation(healthStatus: HealthStatus): Promise<void> {
    try {
      const recovery: RecoveryResult =
        await this.recoveryService.handleSystemDegradation(healthStatus);

      if (!recovery.success) {
        await this.escalateIssue({
          type: 'degradation',
          status: healthStatus,
          recovery,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle degradation: ${(error as Error).message}`,
      );
      await this.escalateIssue({
        type: 'recovery_failed',
        error: (error as Error).message,
        status: healthStatus,
      });
    }
  }

  private async checkResourceUsage(): Promise<void> {
    const metricsData = (await this.monitoringService.getPerformanceMetrics(
      Date.now() - 60000,
      Date.now(),
      // Ensure disk is included
    )) as {
      cpu: number;
      memory: number;
      disk?: number;
      loadAverage: number;
      timestamp: string;
    };
    const metrics: Metrics = {
      status: 'healthy', // or derive this value based on your logic
      metrics: {
        ...metricsData,
        disk: metricsData.disk || 0, // Ensure disk is included
      },
      timestamp: new Date().toISOString(),
    };

    if (metrics.metrics.cpu > this.thresholds.cpuUsage) {
      await this.handleHighCPU(metrics.metrics.cpu);
    }

    if (metrics.metrics.memory > this.thresholds.memoryUsage) {
      await this.handleHighMemory(metrics.metrics.memory);
    }

    if (metrics.metrics.disk > this.thresholds.diskUsage) {
      await this.handleHighDiskUsage(metrics.metrics.disk);
    }
  }

  private async checkQueueHealth(): Promise<void> {
    const queueMetrics: QueueMetrics = {
      waiting: 0,
      errorRate: 0,
      ...(await this.monitoringService.getMetrics('lastMinute')),
    };

    for (const [queueName, metrics] of Object.entries(queueMetrics)) {
      if ((metrics as QueueMetrics).waiting > this.thresholds.queueLength) {
        await this.handleQueueBacklog(queueName, metrics);
      }

      if ((metrics as QueueMetrics).errorRate > this.thresholds.errorRate) {
        await this.handleHighErrorRate(queueName, metrics);
      }
    }
  }

  private async detectAnomalies(metrics: Metrics): Promise<void> {
    const anomalies: Anomaly[] = [];

    // Check for response time anomalies
    if (
      metrics.metrics.api &&
      this.isAnomaly(
        metrics.metrics.api.responseTime,
        metrics.metrics.api.historicalResponseTime,
      )
    ) {
      anomalies.push({
        type: 'response_time',
        current: metrics.metrics.api.responseTime,
        historical: metrics.metrics.api.historicalResponseTime,
      });
    }

    // Check for error rate anomalies
    if (
      this.isAnomaly(
        metrics.metrics.api?.errorRate ?? 0,
        metrics.metrics.api?.historicalErrorRate ?? [],
      )
    ) {
      anomalies.push({
        type: 'error_rate',
        current: metrics.metrics.api?.errorRate ?? 0,
        historical: metrics.metrics.api?.historicalErrorRate ?? [],
      });
    }

    for (const anomaly of anomalies) {
      await this.handleAnomaly(anomaly);
    }
  }

  private async predictResourceNeeds(metrics: Metrics): Promise<void> {
    const predictions = {
      cpu: this.predictUsage(
        metrics.metrics.performance?.cpu
          ? [metrics.metrics.performance.cpu]
          : [],
      ),
      memory: this.predictUsage(
        metrics.metrics.performance?.memory
          ? [metrics.metrics.performance.memory]
          : [],
      ),
      disk: this.predictUsage(
        metrics.metrics.performance?.disk
          ? [metrics.metrics.performance.disk]
          : [],
      ),
    };

    if (predictions.cpu > this.thresholds.cpuUsage) {
      await this.requestResourceScaling('cpu', predictions.cpu);
    }

    if (predictions.memory > this.thresholds.memoryUsage) {
      await this.requestResourceScaling('memory', predictions.memory);
    }

    if (predictions.disk > this.thresholds.diskUsage) {
      await this.requestResourceScaling('disk', predictions.disk);
    }
  }

  private async requestResourceScaling(
    resourceType: string,
    predictedUsage: number,
  ): Promise<void> {
    this.logger.log(
      `Requesting scaling for ${resourceType} to handle predicted usage of ${predictedUsage}%`,
    );
    // Implement the logic to request resource scaling, e.g., call an API or adjust configurations
  }

  private predictUsage(historicalData: number[]): number {
    try {
      // Simple exponential moving average for prediction
      const alpha = 0.2; // Smoothing factor
      let prediction = historicalData[0];

      for (let i = 1; i < historicalData.length; i++) {
        prediction = alpha * historicalData[i] + (1 - alpha) * prediction;
      }

      return prediction;
    } catch (error) {
      this.logger.error(`Failed to predict usage: ${(error as Error).message}`);
      return Math.max(...historicalData); // Fallback to maximum historical value
    }
  }

  private async handleHighCPU(usage: number): Promise<void> {
    try {
      this.logger.warn(`High CPU usage detected: ${usage}%`);

      // Check active workers and their load
      const workerMetrics: WorkerMetrics[] = await this.getWorkerMetrics();
      const overloadedWorkers = workerMetrics.filter((w) => w.cpu > 80);

      if (overloadedWorkers.length > 0) {
        // Scale up workers if needed
        await this.scaleWorkers(overloadedWorkers.length);

        // Redistribute workload
        await this.redistributeWorkload(overloadedWorkers);
      }

      // Optimize queue processing
      await this.optimizeQueueProcessing();
    } catch (error) {
      this.logger.error(
        `Failed to handle high CPU: ${(error as Error).message}`,
      );
      await this.notifyAdmins('cpu_alert', {
        usage,
        error: (error as Error).message,
      });
    }
  }

  private async optimizeQueueProcessing(): Promise<void> {
    this.logger.log('Optimizing queue processing');
    // Implement the logic to optimize queue processing
  }

  private async redistributeWorkload(
    overloadedWorkers: WorkerMetrics[],
  ): Promise<void> {
    this.logger.log(
      `Redistributing workload among ${overloadedWorkers.length} overloaded workers`,
    );
    // Implement the logic to redistribute workload among workers
  }

  private async scaleWorkers(count: number): Promise<void> {
    this.logger.log(`Scaling up ${count} workers`);
    // Implement the logic to scale up workers, e.g., call an API or adjust configurations
  }

  private async getWorkerMetrics(): Promise<WorkerMetrics[]> {
    // Implement the logic to get worker metrics
    return [{ cpu: 75 }, { cpu: 85 }, { cpu: 60 }];
  }

  private async handleHighMemory(usage: number): Promise<void> {
    try {
      this.logger.warn(`High memory usage detected: ${usage}%`);

      // Identify memory leaks
      const leaks = await this.detectMemoryLeaks();
      if (leaks.length > 0) {
        await this.handleMemoryLeaks(leaks);
      }

      // Clear caches if necessary
      if (usage > 90) {
        await this.clearSystemCaches();
      }

      // Restart memory-intensive processes
      const intensiveProcesses = await this.getMemoryIntensiveProcesses();
      await this.restartProcesses(intensiveProcesses);
    } catch (error) {
      this.logger.error(
        `Failed to handle high memory: ${(error as Error).message}`,
      );
      await this.notifyAdmins('memory_alert', {
        usage,
        error: (error as Error).message,
      });
    }
  }

  private async restartProcesses(processes: string[]): Promise<void> {
    this.logger.log(`Restarting processes: ${processes.join(', ')}`);
    // Implement the logic to restart processes
  }

  private async getMemoryIntensiveProcesses(): Promise<string[]> {
    // Implement the logic to get memory-intensive processes
    return ['Process 1', 'Process 2'];
  }

  private async clearSystemCaches(): Promise<void> {
    this.logger.log('Clearing system caches');
    // Implement the logic to clear system caches
  }

  private async handleMemoryLeaks(leaks: string[]): Promise<void> {
    this.logger.log(`Handling memory leaks: ${leaks.join(', ')}`);
    // Implement the logic to handle memory leaks
  }

  private async detectMemoryLeaks(): Promise<string[]> {
    // Implement the logic to detect memory leaks
    return ['Leak 1', 'Leak 2'];
  }

  private async handleHighDiskUsage(usage: number): Promise<void> {
    try {
      this.logger.warn(`High disk usage detected: ${usage}%`);

      // Clean up temporary files
      const cleanedSpace = await this.cleanupTemporaryFiles();

      // Compress old logs
      const compressedSpace = await this.compressOldLogs();

      // Archive old data
      if (usage > 90) {
        await this.archiveOldData();
      }

      this.logger.log(
        `Freed up ${cleanedSpace + compressedSpace} MB of disk space`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle high disk usage: ${(error as Error).message}`,
      );
      await this.notifyAdmins('disk_alert', {
        usage,
        error: (error as Error).message,
      });
    }
  }

  private async archiveOldData(): Promise<void> {
    this.logger.log('Archiving old data');
    // Implement the logic to archive old data
  }

  private async compressOldLogs(): Promise<number> {
    this.logger.log('Compressing old logs');
    // Implement the logic to compress old logs and return the amount of freed space
    return 50; // Example: returning 50 MB of freed space
  }

  private async cleanupTemporaryFiles(): Promise<number> {
    this.logger.log('Cleaning up temporary files');
    // Implement the logic to clean up temporary files and return the amount of freed space
    return 100; // Example: returning 100 MB of freed space
  }

  private async notifyAdmins(alertType: string, details: any): Promise<void> {
    // Implement the logic to notify admins, e.g., send an email or log the alert
    this.logger.warn(`Admin notification: ${alertType}`, details);
  }

  private async handleHighErrorRate(
    queueName: string,
    metrics: any,
  ): Promise<void> {
    try {
      this.logger.warn(`High error rate detected in ${queueName}`);

      // Analyze error patterns
      const errorPatterns: ErrorPattern[] = await this.analyzeErrorPatterns();

      // Adjust error handling strategies
      for (const pattern of errorPatterns) {
        await this.handleErrorPattern(pattern);
      }

      // Notify admins if necessary
      if (metrics.errorRate > this.thresholds.errorRate * 2) {
        await this.notifyAdmins('high_error_rate', { queueName, metrics });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle high error rate: ${(error as Error).message}`,
      );
      await this.notifyAdmins('error_rate_alert', {
        queueName,
        metrics,
        error: (error as Error).message,
      });
    }
  }

  private calculateRecommendedWorkers(patterns: ErrorPattern[]): number {
    // Implement the logic to calculate recommended workers based on patterns
    return patterns.length; // Example: return the number of patterns as recommended workers
  }

  private async handleQueueBacklog(
    queueName: string,
    metrics: any,
  ): Promise<void> {
    try {
      this.logger.warn(`Queue backlog detected in ${queueName}`);

      // Analyze queue patterns
      const patterns: ErrorPattern[] = await this.analyzeErrorPatterns();
      const recommendedWorkers = this.calculateRecommendedWorkers(patterns);
      await this.scaleWorkers(recommendedWorkers);

      // Scale workers based on patterns
      const systematicPatterns = patterns.filter(
        (pattern) => pattern.isSystematic,
      );
      if (systematicPatterns.length > 0) {
        const recommendedWorkers =
          this.calculateRecommendedWorkers(systematicPatterns);
        await this.scaleWorkers(recommendedWorkers);
      }

      // Check for stuck jobs
      const stuckJobs = await this.identifyStuckJobs();
      if (stuckJobs.length > 0) {
        await this.recoveryService.handleStuckJobs(stuckJobs);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle queue backlog: ${(error as Error).message}`,
      );
      await this.notifyAdmins('queue_alert', {
        queueName,
        metrics,
        error: (error as Error).message,
      });
    }
  }
  private async identifyStuckJobs(): Promise<{ queue: string; job: any }[]> {
    // Implement the logic to identify stuck jobs in the queue
    return [
      {
        queue: 'default',
        job: { id: '1', moveToFailed: async () => {}, retry: async () => {} },
      },
      {
        queue: 'default',
        job: { id: '2', moveToFailed: async () => {}, retry: async () => {} },
      },
    ]; // Example: returning a list of stuck jobs with queue and job information
  }

  private async documentErrorPattern(pattern: ErrorPattern): Promise<void> {
    this.logger.log(`Documenting error pattern: ${pattern.type}`);
    // Implement the logic to document the error pattern
  }

  private async updateMonitoringRules(pattern: ErrorPattern): Promise<void> {
    this.logger.log(`Updating monitoring rules for pattern: ${pattern.type}`);
    // Implement the logic to update monitoring rules based on the pattern
  }

  private async optimizeRetryStrategy(pattern: ErrorPattern): Promise<void> {
    this.logger.log(`Optimizing retry strategy for pattern: ${pattern.type}`);
    // Implement the logic to optimize retry strategy based on the pattern
  }

  private async handleErrorPattern(pattern: ErrorPattern): Promise<void> {
    try {
      this.logger.warn(`Error pattern detected: ${pattern.type}`);

      // Update error handling strategies
      await this.updateErrorHandlers(pattern);

      // Adjust retry strategies
      if (pattern.isRetryable) {
        await this.optimizeRetryStrategy(pattern);
      }

      // Update monitoring rules
      await this.updateMonitoringRules(pattern);

      // Document pattern for analysis
      await this.documentErrorPattern(pattern);
    } catch (error) {
      this.logger.error(
        `Failed to handle error pattern: ${(error as Error).message}`,
      );
      await this.notifyAdmins('pattern_alert', {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  private async updateErrorHandlers(pattern: ErrorPattern): Promise<void> {
    this.logger.log(`Updating error handlers for pattern: ${pattern.type}`);
    // Implement the logic to update error handlers based on the pattern
  }

  private async handleAnomaly(anomaly: Anomaly): Promise<void> {
    try {
      this.logger.warn(`Anomaly detected: ${anomaly.type}`);

      // Record anomaly for pattern analysis
      await this.recordAnomaly(anomaly);

      // Adjust system parameters
      await this.adjustSystemParameters(anomaly);

      // Update monitoring thresholds
      await this.updateThresholds(anomaly);
    } catch (error) {
      this.logger.error(
        `Failed to handle anomaly: ${(error as Error).message}`,
      );
      await this.notifyAdmins('anomaly_alert', {
        anomaly,
        error: (error as Error).message,
      });
    }
  }

  private async recordAnomaly(anomaly: Anomaly): Promise<void> {
    this.logger.log(`Recording anomaly: ${anomaly.type}`);
    // Implement the logic to record the anomaly
  }

  private async adjustSystemParameters(anomaly: Anomaly): Promise<void> {
    this.logger.log(`Adjusting system parameters for anomaly: ${anomaly.type}`);
    // Implement the logic to adjust system parameters based on the anomaly
  }

  private async updateThresholds(anomaly: Anomaly): Promise<void> {
    this.logger.log(`Updating thresholds based on anomaly: ${anomaly.type}`);
    // Implement the logic to update thresholds based on the anomaly
  }

  private async optimizeResourceAllocation(): Promise<void> {
    try {
      // Analyze resource usage patterns
      await this.analyzeErrorPatterns();

      // Optimize worker pool size
      await this.optimizeWorkerPool();

      // Adjust queue concurrency
      await this.adjustQueueConcurrency();

      // Update resource limits
      await this.updateResourceLimits();
    } catch (error) {
      this.logger.error(
        `Failed to optimize resources: ${(error as Error).message}`,
      );
    }
  }

  private async adjustQueueConcurrency(): Promise<void> {
    // Implement the logic to adjust queue concurrency
    this.logger.log('Queue concurrency adjusted');
  }

  private async optimizeWorkerPool(): Promise<void> {
    // Implement the logic to optimize the worker pool based on patterns
    this.logger.log('Worker pool optimized based on patterns');
  }

  private async updateResourceLimits(): Promise<void> {
    // Implement the logic to update resource limits based on patterns
    this.logger.log('Resource limits updated based on patterns');
  }

  private async escalateIssue(issue: any): Promise<void> {
    this.logger.error(`Escalating issue: ${JSON.stringify(issue)}`);
    // Add your escalation logic here, e.g., notify admins, create a ticket, etc.
  }

  private isAnomaly(current: number, historical: number[]): boolean {
    const mean = historical.reduce((a, b) => a + b, 0) / historical.length;
    const stdDev = Math.sqrt(
      historical.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
        historical.length,
    );

    return Math.abs(current - mean) > 2 * stdDev; // Using 2 standard deviations as threshold
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReport(): Promise<void> {
    try {
      const report = await this.generateSystemHealthReport();
      await this.emailService.sendAdminReport(report);
    } catch (error) {
      this.logger.error(
        `Failed to generate daily report: ${(error as Error).message}`,
      );
    }
  }

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly recoveryService: RecoveryService,
    private readonly emailService: LocalEmailService,
    private readonly healthService: HealthService,
  ) {}

  private async analyzeErrorPatterns(): Promise<ErrorPattern[]> {
    // Implement the logic to analyze error patterns
    return [];
  }
}
