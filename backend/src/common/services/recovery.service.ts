import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { MonitoringService } from './monitoring.service';
import { EmailService } from '../../email/services/email.service';

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);
  private isRecoveryInProgress = false;

  constructor(
    @InjectQueue('file-processing') private readonly fileQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly healthService: HealthService,
    private readonly monitoringService: MonitoringService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async handleSystemDegradation(
    healthStatus: any,
    autoRecover = true,
  ): Promise<{
    success: boolean;
    actions: string[];
    details: Record<string, any>;
  }> {
    if (this.isRecoveryInProgress) {
      return {
        success: false,
        actions: ['Recovery already in progress'],
        details: { status: 'skipped' },
      };
    }

    this.isRecoveryInProgress = true;
    const actions: string[] = [];
    let success = true;

    try {
      // Check each component and attempt recovery
      if (healthStatus.details.queues.status !== 'healthy') {
        const queueRecovery = await this.recoverQueues();
        actions.push(...queueRecovery.actions);
        success = success && queueRecovery.success;
      }

      if (healthStatus.details.memory.status !== 'healthy') {
        const memoryRecovery = await this.recoverMemoryIssues();
        actions.push(...memoryRecovery.actions);
        success = success && memoryRecovery.success;
      }

      if (healthStatus.details.disk.status !== 'healthy') {
        const diskRecovery = await this.recoverDiskSpace();
        actions.push(...diskRecovery.actions);
        success = success && diskRecovery.success;
      }

      // Log recovery attempt
      await this.logRecoveryAttempt({
        trigger: healthStatus,
        actions,
        success,
        timestamp: new Date(),
      });

      // Notify administrators
      await this.notifyRecoveryAttempt({
        success,
        actions,
        healthStatus,
      });

      return {
        success,
        actions,
        details: await this.healthService.checkHealth(),
      };
    } finally {
      this.isRecoveryInProgress = false;
    }
  }

  private async recoverQueues(): Promise<{
    success: boolean;
    actions: string[];
  }> {
    const actions: string[] = [];
    const success = true;

    try {
      // Check for stuck jobs
      const stuckJobs = await this.findStuckJobs();
      if (stuckJobs.length > 0) {
        await this.reprocessStuckJobs(stuckJobs);
        actions.push(`Reprocessed ${stuckJobs.length} stuck jobs`);
      }

      // Check for failed jobs
      const failedJobs = await this.findFailedJobs();
      if (failedJobs.length > 0) {
        await this.retryFailedJobs(failedJobs);
        actions.push(`Retried ${failedJobs.length} failed jobs`);
      }

      // Clean up completed jobs
      const cleaned = await this.cleanupOldJobs();
      actions.push(`Cleaned up ${cleaned} old jobs`);

      return { success, actions };
    } catch (error) {
      this.logger.error(`Queue recovery failed: ${error.message}`);
      return {
        success: false,
        actions: [...actions, `Recovery failed: ${error.message}`],
      };
    }
  }

  private async recoverMemoryIssues(): Promise<{
    success: boolean;
    actions: string[];
  }> {
    const actions: string[] = [];
    const success = true;

    try {
      // Clear Redis cache if memory usage is high
      const memoryStat = await this.getMemoryStats();
      if (memoryStat.usagePercentage > 85) {
        await this.clearRedisCache();
        actions.push('Cleared Redis cache due to high memory usage');
      }

      // Restart workers with high memory usage
      const problematicWorkers = await this.identifyProblematicWorkers();
      if (problematicWorkers.length > 0) {
        await this.restartWorkers(problematicWorkers);
        actions.push(
          `Restarted ${problematicWorkers.length} workers with high memory usage`,
        );
      }

      // Clean up temporary files
      const cleanedFiles = await this.cleanupTempFiles();
      if (cleanedFiles > 0) {
        actions.push(`Cleaned up ${cleanedFiles} temporary files`);
      }

      return { success, actions };
    } catch (error) {
      this.logger.error(`Memory recovery failed: ${error.message}`);
      return {
        success: false,
        actions: [...actions, `Memory recovery failed: ${error.message}`],
      };
    }
  }

  private async recoverDiskSpace(): Promise<{
    success: boolean;
    actions: string[];
  }> {
    const actions: string[] = [];
    const success = true;

    try {
      // Clean up old logs
      const logsRemoved = await this.cleanupOldLogs();
      actions.push(`Removed ${logsRemoved} old log files`);

      // Remove temporary uploads
      const tempFilesRemoved = await this.cleanupTempUploads();
      actions.push(`Removed ${tempFilesRemoved} temporary upload files`);

      // Clean up failed upload chunks
      const chunksRemoved = await this.cleanupFailedUploadChunks();
      actions.push(`Removed ${chunksRemoved} failed upload chunks`);

      // Compress old files if needed
      const filesCompressed = await this.compressOldFiles();
      if (filesCompressed > 0) {
        actions.push(`Compressed ${filesCompressed} old files`);
      }

      return { success, actions };
    } catch (error) {
      this.logger.error(`Disk space recovery failed: ${error.message}`);
      return {
        success: false,
        actions: [...actions, `Disk space recovery failed: ${error.message}`],
      };
    }
  }

  private async findStuckJobs(): Promise<any[]> {
    const stuckJobs = [];

    // Check file processing queue
    const activeFileJobs = await this.fileQueue.getActive();
    for (const job of activeFileJobs) {
      if (Date.now() - job.timestamp > 3600000) {
        // 1 hour
        stuckJobs.push({
          queue: 'file-processing',
          job,
        });
      }
    }

    // Check email queue
    const activeEmailJobs = await this.emailQueue.getActive();
    for (const job of activeEmailJobs) {
      if (Date.now() - job.timestamp > 300000) {
        // 5 minutes
        stuckJobs.push({
          queue: 'email',
          job,
        });
      }
    }

    return stuckJobs;
  }

  private async reprocessStuckJobs(stuckJobs: any[]): Promise<void> {
    for (const { queue, job } of stuckJobs) {
      try {
        await job.moveToFailed({
          message: 'Job stuck and requeued by recovery process',
        });
        await job.retry();
        this.logger.log(`Requeued stuck job ${job.id} in ${queue} queue`);
      } catch (error) {
        this.logger.error(
          `Failed to reprocess stuck job ${job.id}: ${error.message}`,
        );
      }
    }
  }

  private async cleanupOldLogs(): Promise<number> {
    try {
      const retentionDays = this.configService.get('LOG_RETENTION_DAYS', 30);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old logs from database
      const result = await this.connection
        .createQueryBuilder()
        .delete()
        .from('system_logs')
        .where('created_at < :cutoffDate', { cutoffDate })
        .execute();

      return result.affected || 0;
    } catch (error) {
      this.logger.error(`Failed to cleanup old logs: ${error.message}`);
      return 0;
    }
  }

  private async cleanupTempUploads(): Promise<number> {
    try {
      const retentionHours = this.configService.get(
        'TEMP_UPLOAD_RETENTION_HOURS',
        24,
      );
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - retentionHours);

      const tempFiles = await this.getTemporaryFiles(cutoffDate);

      for (const file of tempFiles) {
        await this.storageService.deleteFile(file.path);
      }

      return tempFiles.length;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup temporary uploads: ${error.message}`,
      );
      return 0;
    }
  }

  private async cleanupFailedUploadChunks(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24);

      const failedChunks = await this.fileChunkRepository.find({
        where: {
          createdAt: LessThan(cutoffDate),
          status: 'failed',
        },
      });

      for (const chunk of failedChunks) {
        await this.storageService.deleteFile(chunk.path);
        await this.fileChunkRepository.remove(chunk);
      }

      return failedChunks.length;
    } catch (error) {
      this.logger.error(`Failed to cleanup failed chunks: ${error.message}`);
      return 0;
    }
  }

  private async compressOldFiles(): Promise<number> {
    try {
      const compressionAgeMonths = this.configService.get(
        'FILE_COMPRESSION_AGE_MONTHS',
        3,
      );
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - compressionAgeMonths);

      const filesToCompress = await this.fileRepository.find({
        where: {
          createdAt: LessThan(cutoffDate),
          compressed: false,
          status: 'active',
        },
      });

      let compressedCount = 0;
      for (const file of filesToCompress) {
        try {
          await this.compressFile(file);
          compressedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to compress file ${file.id}: ${error.message}`,
          );
        }
      }

      return compressedCount;
    } catch (error) {
      this.logger.error(`Failed to compress old files: ${error.message}`);
      return 0;
    }
  }

  private async compressFile(file: any): Promise<void> {
    // Implement file compression logic here
    // This could involve downloading the file, compressing it,
    // uploading the compressed version, and updating the metadata
    this.logger.log(`Compressing file: ${file.id}`);
  }

  private async logRecoveryAttempt(data: any): Promise<void> {
    try {
      await this.systemLogsRepository.save({
        type: 'recovery',
        data,
        createdAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to log recovery attempt: ${error.message}`);
    }
  }

  private async notifyRecoveryAttempt(data: any): Promise<void> {
    try {
      await this.emailService.sendAdminNotification({
        subject: `System Recovery Attempt - ${data.success ? 'Successful' : 'Failed'}`,
        template: 'recovery-notification',
        data,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send recovery notification: ${error.message}`,
      );
    }
  }
}
