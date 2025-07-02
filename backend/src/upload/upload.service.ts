import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { UploadQueueService } from './upload.queue';
import { StorageService } from './services/storage.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly uploadQueueService: UploadQueueService,
    private readonly storageService: StorageService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ fileId: string; jobId: string }> {
    try {
      // Generate unique ID for the file
      const fileId = uuidv4();

      // Save file to temporary storage (could be local disk or S3)
      const filePath = await this.saveFileToStorage(file, fileId);

      // Add file to processing queue
      const job = await this.uploadQueueService.addFileProcessingJob({
        fileId,
        filePath,
        userId,
        originalFilename: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
      });

      // Convert the job ID to a string
      const jobId = job.toString();

      this.logger.log(
        `File ${fileId} queued for processing with job ID ${jobId}`,
      );

      return { fileId, jobId };
    } catch (error: unknown) {
      // Fixed error handling
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Error uploading file: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async saveFileToStorage(
    file: Express.Multer.File,
    fileId: string,
  ): Promise<string> {
    // Implementation details for saving file
    return this.storageService.saveFile(file, fileId);
  }

  async getJobStatus(jobId: string) {
    return this.uploadQueueService.getJobStatus(jobId);
  }
}
