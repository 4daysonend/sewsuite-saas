import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { File, FileStatus } from '../entities/file.entity';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectQueue('file-processing')
    private readonly fileProcessingQueue: Queue,
  ) {}

  /**
   * Update file status and save
   * @param fileId ID of the file to update
   * @param status New status
   * @param error Optional error message
   */
  async updateFileStatus(
    fileId: string,
    status: FileStatus,
    error?: Error,
  ): Promise<File> {
    this.logger.debug(`Updating file status: ${fileId} -> ${status}`);

    const file = await this.fileRepository.findOne({ where: { id: fileId } });

    if (!file) {
      this.logger.warn(`File not found: ${fileId}`);
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    file.status = status;
    if (error) {
      this.logger.error(
        `Error processing file ${fileId}: ${error.message}`,
        error.stack,
      );
      file.addHistoryEvent('status-update', status, error.message);
    }

    this.logger.debug(`File status updated: ${fileId}`);
    return this.fileRepository.save(file);
  }

  /**
   * Process file after upload
   * @param file The file to process
   */
  async processUploadedFile(file: File): Promise<void> {
    this.logger.log(`Processing uploaded file: ${file.id} (${file.mimeType})`);

    // After upload completes
    file.status = FileStatus.UPLOADED;
    await this.fileRepository.save(file);

    // Then queue appropriate processing jobs based on file type
    if (file.mimeType.startsWith('image/')) {
      this.logger.debug(`Queueing thumbnail generation for image: ${file.id}`);
      await this.fileProcessingQueue.add('generate-thumbnails', {
        fileId: file.id,
        sizes: [100, 300, 600],
      });
    } else if (file.mimeType === 'application/pdf') {
      this.logger.debug(`Queueing PDF processing for: ${file.id}`);
      file.status = FileStatus.QUEUED_FOR_PROCESSING;
      await this.fileRepository.save(file);

      await this.fileProcessingQueue.add('extract-pdf-metadata', {
        fileId: file.id,
      });
      await this.fileProcessingQueue.add('generate-pdf-thumbnail', {
        fileId: file.id,
        filePath: file.path, // Make sure to use path, not storagePath
      });
    }
  }

  /**
   * Generate thumbnails for a file
   * @param fileId The file ID to generate thumbnails for
   */
  async generateThumbnails(fileId: string): Promise<void> {
    const file = await this.getFileById(fileId);
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }
    // Add thumbnail generation logic here
  }

  async saveFile(file: File): Promise<File> {
    const savedFile = await this.fileRepository.save(file);

    // Process the uploaded file
    await this.processUploadedFile(savedFile);

    return savedFile;
  }

  async getFileById(id: string): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    return file;
  }
}
