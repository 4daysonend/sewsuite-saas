import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';

@Injectable()
export class UploadQueueService {
  private readonly logger = new Logger(UploadQueueService.name);

  constructor(@InjectQueue('upload') private readonly uploadQueue: Queue) {}

  async addFileProcessingJob(
    fileData: {
      fileId: string;
      filePath: string;
      userId: string;
      originalFilename: string;
      fileType: string;
      fileSize: number;
    },
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      timeout?: number;
    },
  ) {
    this.logger.log(
      `Adding file processing job for ${fileData.originalFilename}`,
    );

    const job = await this.uploadQueue.add('processFile', fileData, {
      priority: options?.priority || 1, // Lower number = higher priority
      attempts: options?.attempts || 3,
      backoff: { type: 'exponential', delay: 5000 }, // Retry with exponential backoff
      timeout: options?.timeout || 120000, // 2 minutes timeout
      delay: options?.delay || 0,
      removeOnComplete: true, // Remove jobs from queue when completed
      removeOnFail: false, // Keep failed jobs for inspection
    });

    this.logger.log(
      `File processing job ${job.id} created for ${fileData.originalFilename}`,
    );

    return job.id;
  }

  async getJobStatus(jobId: string) {
    const job = await this.uploadQueue.getJob(jobId);
    if (!job) {
      return { found: false };
    }

    const state = await job.getState();
    const progress = await job.progress();

    return {
      found: true,
      id: job.id,
      state,
      progress,
      data: job.data,
      failedReason: job.failedReason,
      attempts: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  async removeJob(jobId: string) {
    const job = await this.uploadQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return { removed: true };
    }
    return { removed: false };
  }
}
