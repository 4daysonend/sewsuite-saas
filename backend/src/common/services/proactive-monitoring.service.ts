import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { MonitoringService } from './monitoring.service';
import { RecoveryService } from './recovery.service';

@Injectable()
export class ProactiveMonitoringService {
  private readonly logger = new Logger(ProactiveMonitoringService.name);
  private readonly thresholds: Record<string, number>;

  constructor(
    private readonly healthService: HealthService,
    private readonly monitoringService: MonitoringService,
    private readonly recoveryService: RecoveryService,
    private readonly configService: ConfigService,
  ) {
    this.thresholds = {
      cpuUsage: this.configService.get('THRESHOLD_CPU_USAGE', 80),
      memoryUsage: this.configService.get('THRESHOLD_MEMORY_USAGE', 85),
      diskUsage: this.configService.get('THRESHOLD_DISK_USAGE', 85),
      queueLength: this.configService.get('THRESHOLD_QUEUE_LENGTH', 1000),
      errorRate: this.configService.get('THRESHOLD_ERROR_RATE', 0.05),
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSystemHealth(): Promise<void> {
    try {
      const healthStatus = await this.healthService.checkHealth();

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
      const metrics = await this.monitoringService.getMetricsSummary();
      await this.detectAnomalies(metrics);
      await this.predictResourceNeeds(metrics);
      await this.optimizeResourceAllocation(metrics);
    } catch (error) {
      this.logger.error(`Performance analysis failed: ${error.message}`);
    }
  }

  private async handleDegradation(healthStatus: any): Promise<void> {
    try {
      const recovery =
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
    const metrics = await this.monitoringService.getPerformanceMetrics('1m');

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
    const queueMetrics = await this.monitoringService.getQueueMetrics();

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
    const patterns = this.detectErrorPatterns(errors);

    for (const pattern of patterns) {
      if (pattern.significance > 0.7) {
        // 70% confidence threshold
        await this.handleErrorPattern(pattern);
      }
    }
  }

  private async detectAnomalies(metrics: any): Promise<void> {
    const anomalies = [];

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

  private async predictResourceNeeds(metrics: any): Promise<void> {
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
}
