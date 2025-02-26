import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { File, FileStatus, FileCategory } from '../entities/file.entity';
import { FileChunk } from '../entities/file-chunk.entity';
import { StorageQuota } from '../entities/storage-quota.entity';
import { FileProcessingService } from './file-processing.service';
import { FileStorageService } from './file-storage.service';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ChunkUploadDto } from '../dto/chunk-upload.dto';
import { User } from '../../users/entities/user.entity';
import { PaginationOptions } from '../../common/interfaces/pagination.interface';

interface FileUploadResult {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: FileStatus;
  category: FileCategory;
  publicUrl?: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly maxSimultaneousUploads: number;

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(FileChunk)
    private readonly fileChunkRepository: Repository<FileChunk>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
    private readonly processingService: FileProcessingService,
    private readonly storageService: FileStorageService,
    private readonly configService: ConfigService,
    @InjectQueue('file-processing')
    private readonly processingQueue: Queue,
  ) {
    this.maxSimultaneousUploads = this.configService.get<number>('MAX_SIMULTANEOUS_UPLOADS', 5);
  }

  /**
   * Upload a file to storage
   * @param file File to upload
   * @param uploadFileDto Upload options
   * @param user User uploading the file
   * @returns Uploaded file information
   */
  async uploadFile(
    file: Express.Multer.File,
    uploadFileDto: UploadFileDto,
    user: User,
  ): Promise<FileUploadResult> {
    // Check quota before proceeding
    await this.checkQuota(user, file.size);

    // Check simultaneous uploads
    const activeUploads = await this.getActiveUploadsCount(user.id);
    if (activeUploads >= this.maxSimultaneousUploads) {
      throw new BadRequestException(
        `Maximum of ${this.maxSimultaneousUploads} simultaneous uploads allowed`
      );
    }

    // Create file entity
    const fileEntity = this.fileRepository.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category: uploadFileDto.category,
      status: FileStatus.PENDING,
      uploader: user,
      metadata: {
        description: uploadFileDto.description,
        tags: uploadFileDto.tags || [],
        uploadStarted: new Date().toISOString(),
      },
    });

    if (uploadFileDto.orderId) {
      fileEntity.order = { id: uploadFileDto.orderId } as any;
    }

    // Save initial file entity
    await this.fileRepository.save(fileEntity);

    try {
      // Process and store the file
      await this.processingService.processFile(file, fileEntity);

      // Update quota
      await this.updateQuota(user.id, file.size);

      // Queue additional processing if needed
      await this.queueAdditionalProcessing(fileEntity);

      // Save updated file entity
      const savedFile = await this.fileRepository.save(fileEntity);

      return {
        id: savedFile.id,
        originalName: savedFile.originalName,
        size: savedFile.size,
        mimeType: savedFile.mimeType,
        status: savedFile.status,
        category: savedFile.category,
        publicUrl: savedFile.publicUrl,
      };
    } catch (error) {
      this.logger.error(
        `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      fileEntity.status = FileStatus.FAILED;
      fileEntity.metadata = {
        ...fileEntity.metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorTimestamp: new Date().toISOString(),
      };
      
      await this.fileRepository.save(fileEntity);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('File processing failed');
    }
  }

  /**
   * Handle file chunk upload (for large files)
   * @param chunk File chunk
   * @param chunkUploadDto Chunk metadata
   * @param user User uploading the chunk
   * @returns Status of chunk receipt
   */
  async handleChunkUpload(
    chunk: Express.Multer.File,
    chunkUploadDto: ChunkUploadDto,
    user: User,
  ): Promise<{ received: boolean; chunksReceived: number; totalChunks: number }> {
    const { fileId, chunkNumber, totalChunks } = chunkUploadDto;

    // Get or validate file entity
    const fileEntity = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader'],
    });

    if (!fileEntity) {
      throw new NotFoundException('File not found');
    }

    if (fileEntity.uploader.id !== user.id) {
      throw new ForbiddenException('Unauthorized to upload chunks for this file');
    }

    try {
      // Store chunk path with padding for proper ordering
      const paddedChunkNumber = String(chunkNumber).padStart(
        String(totalChunks).length,
        '0'
      );
      
      const path = `chunks/${fileId}/${paddedChunkNumber}`;

      // Create chunk entity
      const chunkEntity = this.fileChunkRepository.create({
        fileId,
        chunkNumber,
        size: chunk.size,
        path,
        processed: false,
      });

      // Store chunk in storage
      await this.storageService.uploadFile(chunk.buffer, {
        path,
        contentType: 'application/octet-stream',
      });

      await this.fileChunkRepository.save(chunkEntity);

      // Update file metadata with progress
      fileEntity.metadata = {
        ...fileEntity.metadata,
        chunksReceived: fileEntity.metadata.chunksReceived 
          ? fileEntity.metadata.chunksReceived + 1 
          : 1,
        lastChunkReceived: new Date().toISOString(),
      };
      
      await this.fileRepository.save(fileEntity);

      // Check if all chunks are received
      const receivedChunks = await this.getReceivedChunksCount(fileId);

      return { 
        received: true, 
        chunksReceived: receivedChunks,
        totalChunks,
      };
    } catch (error) {
      this.logger.error(
        `Chunk upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw new InternalServerErrorException('Failed to process file chunk');
    }
  }

  /**
   * Complete chunked upload after all chunks received
   * @param fileId File ID
   * @param user User completing the upload
   * @returns Processed file information
   */
  async completeChunkedUpload(fileId: string, user: User): Promise<FileUploadResult> {
    const fileEntity = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader'],
    });

    if (!fileEntity) {
      throw new NotFoundException('File not found');
    }

    if (fileEntity.uploader.id !== user.id) {
      throw new ForbiddenException('Unauthorized to complete this upload');
    }

    // Get chunks and verify all are present
    const chunks = await this.fileChunkRepository.find({
      where: { fileId },
      order: { chunkNumber: 'ASC' },
    });

    const expectedChunksCount = fileEntity.metadata.totalChunks;
    if (chunks.length !== expectedChunksCount) {
      throw new BadRequestException(
        `Cannot complete upload: received ${chunks.length} chunks but expected ${expectedChunksCount}`
      );
    }

    try {
      // Combine chunks
      fileEntity.status = FileStatus.PROCESSING;
      await this.fileRepository.save(fileEntity);

      const completeFile = await this.processingService.combineChunks(chunks, fileEntity);

      // Process combined file
      await this.processingService.processFile(
        { 
          buffer: completeFile,
          size: completeFile.length,
          originalname: fileEntity.originalName,
          mimetype: fileEntity.mimeType,
        } as Express.Multer.File,
        fileEntity
      );

      // Clean up chunks
      await this.cleanupChunks(fileId, chunks);

      // Update quota
      await this.updateQuota(user.id, fileEntity.size);

      // Queue additional processing if needed
      await this.queueAdditionalProcessing(fileEntity);

      // Save updated file entity
      const savedFile = await this.fileRepository.save(fileEntity);

      return {
        id: savedFile.id,
        originalName: savedFile.originalName,
        size: savedFile.size,
        mimeType: savedFile.mimeType,
        status: savedFile.status,
        category: savedFile.category,
        publicUrl: savedFile.publicUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete chunked upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      fileEntity.status = FileStatus.FAILED;
      fileEntity.metadata = {
        ...fileEntity.metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorTimestamp: new Date().toISOString(),
      };
      
      await this.fileRepository.save(fileEntity);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to process chunked upload');
    }
  }

  /**
   * Get download URL for a file
   * @param fileId File ID
   * @param user Requesting user
   * @returns Signed download URL
   */
  async getDownloadUrl(fileId: string, user: User): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader', 'order', 'order.client', 'order.tailor'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check access permissions
    this.checkFileAccess(file, user);

    try {
      const { url, expiresAt } = await this.storageService.generateSignedUrl(file);
      
      // Log download request
      file.metadata = {
        ...file.metadata,
        downloads: (file.metadata.downloads || 0) + 1,
        lastDownloadedAt: new Date().toISOString(),
        lastDownloadedBy: user.id,
      };
      
      await this.fileRepository.save(file);
      
      return { url, expiresAt };
    } catch (error) {
      this.logger.error(
        `Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  /**
   * Get files for a user with optional filtering
   * @param user User to get files for
   * @param category Optional category filter
   * @param pagination Pagination options
   * @returns Files and total count
   */
  async getUserFiles(
    user: User,
    category?: FileCategory,
    pagination: PaginationOptions = { page: 1, limit: 10 },
  ): Promise<{ files: File[]; total: number }> {
    const skip = (pagination.page - 1) * pagination.limit;
    
    const query = this.fileRepository.createQueryBuilder('file')
      .where('file.uploader = :userId', { userId: user.id })
      .andWhere('file.status != :status', { status: FileStatus.PENDING });

    if (category) {
      query.andWhere('file.category = :category', { category });
    }

    const [files, total] = await query
      .orderBy('file.createdAt', 'DESC')
      .skip(skip)
      .take(pagination.limit)
      .getManyAndCount();

    return { files, total };
  }

  /**
   * Delete a file
   * @param fileId File ID to delete
   * @param user User requesting deletion
   */
  async deleteFile(fileId: string, user: User): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.uploader.id !== user.id) {
      throw new ForbiddenException('Unauthorized to delete this file');
    }

    try {
      // Delete from storage
      await this.storageService.deleteFile(file);
      
      // Update user quota
      await this.updateQuota(user.id, -file.size);
      
      // Soft delete in database
      await this.fileRepository.softDelete(fileId);
    } catch (error) {
      this.logger.error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * Get user's storage quota information
   * @param user User to get quota for
   * @returns Quota information
   */
  async getStorageQuota(user: User): Promise<{
    used: number;
    total: number;
    percentage: number;
    quotaByCategory?: Record<FileCategory, number>;
  }> {
    let quota = await this.quotaRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!quota) {
      // Create default quota for user
      const defaultQuota = this.configService.get<number>('DEFAULT_STORAGE_QUOTA', 1073741824); // 1GB
      
      quota = await this.quotaRepository.save({
        user: { id: user.id } as User,
        totalSpace: defaultQuota,
        usedSpace: 0,
      });
    }

    return {
      used: quota.usedSpace,
      total: quota.totalSpace,
      percentage: quota.totalSpace > 0 ? (quota.usedSpace / quota.totalSpace) * 100 : 0,
      quotaByCategory: quota.quotaByCategory,
    };
  }

  /**
   * Check if user has sufficient quota for upload
   * @param user User to check quota for
   * @param fileSize Size of file to upload
   */
  private async checkQuota(user: User, fileSize: number): Promise<void> {
    const quota = await this.getStorageQuota(user);
    
    if (quota.used + fileSize > quota.total) {
      throw new BadRequestException(
        `Storage quota exceeded. Available: ${formatBytes(quota.total - quota.used)}, Required: ${formatBytes(fileSize)}`
      );
    }
  }

  /**
   * Update user's quota after upload/deletion
   * @param userId User ID
   * @param size Size change (positive for addition, negative for reduction)
   */
  private async updateQuota(userId: string, size: number): Promise<void> {
    try {
      const quota = await this.quotaRepository.findOne({
        where: { user: { id: userId } },
      });
      
      if (!quota) {
        this.logger.warn(`Quota not found for user: ${userId}`);
        return;
      }
      
      // Update used space
      quota.usedSpace = Math.max(0, quota.usedSpace + size);
      quota.lastQuotaUpdate = new Date();
      
      await this.quotaRepository.save(quota);
    } catch (error) {
      this.logger.error(
        `Failed to update quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - non-critical operation
    }
  }

  /**
   * Get count of received chunks for a file
   * @param fileId File ID
   * @returns Number of received chunks
   */
  private async getReceivedChunksCount(fileId: string): Promise<number> {
    return this.fileChunkRepository.count({
      where: { fileId },
    });
  }

  /**
   * Get count of active uploads for a user
   * @param userId User ID
   * @returns Number of active uploads
   */
  private async getActiveUploadsCount(userId: string): Promise<number> {
    return this.fileRepository.count({
      where: {
        uploader: { id: userId },
        status: FileStatus.PENDING,
      },
    });
  }

  /**
   * Queue additional processing for a file if needed
   * @param file File to process
   */
  private async queueAdditionalProcessing(file: File): Promise<void> {
    // Check if file needs additional processing
    if (file.mimeType.startsWith('image/')) {
      await this.processingQueue.add('generate-thumbnails', {
        fileId: file.id,
        sizes: [200, 400, 800],
      });
    } else if (file.mimeType === 'application/pdf') {
      await this.processingQueue.add('extract-pdf-metadata', {
        fileId: file.id,
      });
    }
  }

  /**
   * Clean up chunks after successful processing
   * @param fileId File ID
   * @param chunks Chunks to clean up
   */
  private async cleanupChunks(fileId: string, chunks: FileChunk[]): Promise<void> {
    try {
      // Delete chunks from storage
      await Promise.all(
        chunks.map(chunk => this.storageService.deleteFile({
          path: chunk.path,
        }))
      );
      
      // Delete chunks from database
      await this.fileChunkRepository.delete({ fileId });
    } catch (error) {
      this.logger.error(
        `Failed to cleanup chunks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - this is cleanup
    }
  }

  /**
   * Check if user has access to a file
   * @param file File to check access for
   * @param user User requesting access
   */
  private checkFileAccess(file: File, user: User): void {
    const hasAccess = 
      // Owner of the file
      file.uploader.id === user.id ||
      // Client of the order
      (file.order?.client && file.order.client.id === user.id) ||
      // Tailor of the order
      (file.order?.tailor && file.order.tailor.id === user.id);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to access this file');
    }
  }
}

/**
 * Format bytes to human readable format
 * @param bytes Bytes to format
 * @returns Formatted string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}