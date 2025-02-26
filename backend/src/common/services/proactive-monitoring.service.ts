import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { HealthService, HealthStatus } from './health.service';
import {
  MonitoringService,
  Metrics,
  QueueMetrics,
  ErrorPattern,
  Anomaly,
} from './monitoring.service';
import { RecoveryService, RecoveryResult } from './recovery.service';

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

interface QueuePattern {
  isSystematic: boolean;
  recommendedWorkers: number;
}

interface Issue {
  severity: string;
  description: string;
  metrics: any;
  actions: any;
  resolution: any;
}

@Injectable()
export class ProactiveMonitoringService {
  private readonly logger = new Logger(ProactiveMonitoringService.name);
  private readonly thresholds: Thresholds;

  constructor(
    private readonly healthService: HealthService,
    private readonly monitoringService: MonitoringService,
    private readonly recoveryService: RecoveryService,
    private readonly configService: ConfigService,
  ) {
    this.thresholds = {
      cpuUsage: this.configService.get<number>('THRESHOLD_CPU_USAGE', 80),
      memoryUsage: this.configService.get<number>('THRESHOLD_MEMORY_USAGE', 85),
      diskUsage: this.configService.get<number>('THRESHOLD_DISK_USAGE', 85),
      queueLength: this.configService.get<number>(
        'THRESHOLD_QUEUE_LENGTH',
        1000,
      ),
      errorRate: this.configService.get<number>('THRESHOLD_ERROR_RATE', 0.05),
    };
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
      this.logger.error(`Health check failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async performanceAnalysis(): Promise<void> {
    try {
      const metrics: Metrics = await this.monitoringService.getMetricsSummary();
      await this.detectAnomalies(metrics);
      await this.predictResourceNeeds(metrics);
      await this.optimizeResourceAllocation(metrics);
    } catch (error) {
      this.logger.error(`Performance analysis failed: ${error.message}`);
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
      this.logger.error(`Failed to handle degradation: ${error.message}`);
      await this.escalateIssue({
        type: 'recovery_failed',
        error: error.message,
        status: healthStatus,
      });
    }
  }

  private async checkResourceUsage(): Promise<void> {
    const metrics: Metrics =
      await this.monitoringService.getPerformanceMetrics('1m');

    if (metrics.cpu > this.thresholds.cpuUsage) {
      await this.handleHighCPU(metrics.cpu);
    }

    if (metrics.memory > this.thresholds.memoryUsage) {
      await this.handleHighMemory(metrics.memory);
    }

    if (metrics.disk > this.thresholds.diskUsage) {
      await this.handleHighDiskUsage(metrics.disk);
    }
  }

  private async checkQueueHealth(): Promise<void> {
    const queueMetrics: QueueMetrics =
      await this.monitoringService.getQueueMetrics();

    for (const [queueName, metrics] of Object.entries(queueMetrics)) {
      if (metrics.waiting > this.thresholds.queueLength) {
        await this.handleQueueBacklog(queueName, metrics);
      }

      if (metrics.errorRate > this.thresholds.errorRate) {
        await this.handleHighErrorRate(queueName, metrics);
      }
    }
  }

  private async analyzeErrorPatterns(): Promise<void> {
    const errors = await this.monitoringService.getRecentErrors();
    const patterns: ErrorPattern[] = this.detectErrorPatterns(errors);

    for (const pattern of patterns) {
      if (pattern.significance > 0.7) {
        // 70% confidence threshold
        await this.handleErrorPattern(pattern);
      }
    }
  }

  private async detectAnomalies(metrics: Metrics): Promise<void> {
    const anomalies: Anomaly[] = [];

    // Check for response time anomalies
    if (
      this.isAnomaly(
        metrics.api.responseTime,
        metrics.api.historicalResponseTime,
      )
    ) {
      anomalies.push({
        type: 'response_time',
        current: metrics.api.responseTime,
        historical: metrics.api.historicalResponseTime,
      });
    }

    // Check for error rate anomalies
    if (
      this.isAnomaly(metrics.api.errorRate, metrics.api.historicalErrorRate)
    ) {
      anomalies.push({
        type: 'error_rate',
        current: metrics.api.errorRate,
        historical: metrics.api.historicalErrorRate,
      });
    }

    for (const anomaly of anomalies) {
      await this.handleAnomaly(anomaly);
    }
  }

  private async predictResourceNeeds(metrics: Metrics): Promise<void> {
    const predictions = {
      cpu: this.predictUsage(metrics.performance.cpu),
      memory: this.predictUsage(metrics.performance.memory),
      disk: this.predictUsage(metrics.performance.disk),
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
      this.logger.error(`Failed to predict usage: ${error.message}`);
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
      this.logger.error(`Failed to handle high CPU: ${error.message}`);
      await this.notifyAdmins('cpu_alert', { usage, error: error.message });
    }
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
      this.logger.error(`Failed to handle high memory: ${error.message}`);
      await this.notifyAdmins('memory_alert', { usage, error: error.message });
    }
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
      this.logger.error(`Failed to handle high disk usage: ${error.message}`);
      await this.notifyAdmins('disk_alert', { usage, error: error.message });
    }
  }

  private async handleQueueBacklog(
    queueName: string,
    metrics: any,
  ): Promise<void> {
    try {
      this.logger.warn(`Queue backlog detected in ${queueName}`);

      // Analyze queue patterns
      const patterns: QueuePattern = await this.analyzeQueuePatterns(queueName);

      // Scale workers based on patterns
      if (patterns.isSystematic) {
        await this.scaleQueueWorkers(queueName, patterns.recommendedWorkers);
      }

      // Check for stuck jobs
      const stuckJobs = await this.identifyStuckJobs(queueName);
      if (stuckJobs.length > 0) {
        await this.recoveryService.handleStuckJobs(stuckJobs);
      }
    } catch (error) {
      this.logger.error(`Failed to handle queue backlog: ${error.message}`);
      await this.notifyAdmins('queue_alert', {
        queueName,
        metrics,
        error: error.message,
      });
    }
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
      this.logger.error(`Failed to handle error pattern: ${error.message}`);
      await this.notifyAdmins('pattern_alert', {
        pattern,
        error: error.message,
      });
    }
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
      this.logger.error(`Failed to handle anomaly: ${error.message}`);
      await this.notifyAdmins('anomaly_alert', {
        anomaly,
        error: error.message,
      });
    }
  }

  private async optimizeResourceAllocation(metrics: Metrics): Promise<void> {
    try {
      // Analyze resource usage patterns
      const patterns = await this.analyzeResourcePatterns(metrics);

      // Optimize worker pool size
      await this.optimizeWorkerPool(patterns);

      // Adjust queue concurrency
      await this.adjustQueueConcurrency(patterns);

      // Update resource limits
      await this.updateResourceLimits(patterns);
    } catch (error) {
      this.logger.error(`Failed to optimize resources: ${error.message}`);
    }
  }

  private async documentIssue(issue: Issue): Promise<void> {
    await this.systemLogsRepository.save({
      type: 'system_issue',
      severity: issue.severity,
      description: issue.description,
      metrics: issue.metrics,
      actions: issue.actions,
      resolution: issue.resolution,
      createdAt: new Date(),
    });
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
  private async generateDailyReport(): Promise<void> {
    try {
      const report = await this.generateSystemHealthReport();
      await this.emailService.sendAdminReport(report);
    } catch (error) {
      this.logger.error(`Failed to generate daily report: ${error.message}`);
    }
  }
}
