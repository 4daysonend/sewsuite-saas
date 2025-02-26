import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as sharp from 'sharp';
import * as crypto from 'crypto';
import * as fileType from 'file-type';
import * as pdfParse from 'pdf-parse';
import { File, FileStatus, FileMetadata } from '../entities/file.entity';
import { FileChunk } from '../entities/file-chunk.entity';
import { FileStorageService } from './file-storage.service';

interface ProcessingOptions {
  generateThumbnails?: boolean;
  extractMetadata?: boolean;
  sanitize?: boolean;
}

@Injectable()
export class FileProcessingService {
  private readonly logger = new Logger(FileProcessingService.name);
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;
  private readonly maxImageDimension: number;
  private readonly maxPdfPages: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: FileStorageService,
    @InjectQueue('file-processing') private readonly fileQueue: Queue,
  ) {
    this.allowedMimeTypes = this.configService
      .get<string>('ALLOWED_MIME_TYPES', '')
      .split(',')
      .filter(type => type.trim() !== '');
      
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10485760); // Default 10MB
    this.maxImageDimension = this.configService.get<number>('MAX_IMAGE_DIMENSION', 4096);
    this.maxPdfPages = this.configService.get<number>('MAX_PDF_PAGES', 100);
  }

  /**
   * Process file after upload
   * @param file Uploaded file
   * @param fileEntity File entity to update
   * @param options Processing options
   */
  async processFile(
    file: Express.Multer.File,
    fileEntity: File,
    options: ProcessingOptions = {
      generateThumbnails: true,
      extractMetadata: true,
      sanitize: true,
    },
  ): Promise<void> {
    try {
      // Validate file
      await this.validateFile(file);

      // Update file metadata
      fileEntity.size = file.size;
      fileEntity.status = FileStatus.PROCESSING;
      
      // Hash file for integrity verification
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      fileEntity.metadata = {
        ...fileEntity.metadata,
        hash,
        processStarted: new Date().toISOString(),
      };

      // Process file based on type
      if (file.mimetype.startsWith('image/')) {
        await this.processImage(file, fileEntity, options);
      } else if (file.mimetype === 'application/pdf') {
        await this.processPdf(file, fileEntity, options);
      } else {
        await this.processGenericFile(file, fileEntity);
      }

      // Update file status
      fileEntity.status = FileStatus.ACTIVE;
      fileEntity.metadata = {
        ...fileEntity.metadata,
        processCompleted: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      fileEntity.status = FileStatus.FAILED;
      fileEntity.metadata = {
        ...fileEntity.metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorTimestamp: new Date().toISOString(),
      };
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(
        error instanceof Error ? error.message : 'File processing failed'
      );
    }
  }

  /**
   * Combine file chunks into a complete file
   * @param chunks File chunks
   * @param fileEntity Target file entity
   * @returns Combined file buffer
   */
  async combineChunks(chunks: FileChunk[], fileEntity: File): Promise<Buffer> {
    try {
      // Sort chunks by number to ensure correct order
      chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
      
      // Get chunk contents
      const chunkBuffers = await Promise.all(
        chunks.map(chunk => this.storageService.getFileContent({
          path: chunk.path,
        }))
      );
      
      // Combine chunks
      const combinedBuffer = Buffer.concat(chunkBuffers);
      
      // Update file metadata
      fileEntity.size = combinedBuffer.length;
      fileEntity.metadata = {
        ...fileEntity.metadata,
        combinedAt: new Date().toISOString(),
        originalChunks: chunks.length,
      };
      
      // Verify combined file type
      const detectedType = await fileType.fileTypeFromBuffer(combinedBuffer);
      if (detectedType) {
        // Check if detected type matches expected type
        if (fileEntity.mimeType !== detectedType.mime) {
          this.logger.warn(
            `File type mismatch: expected ${fileEntity.mimeType}, detected ${detectedType.mime}`
          );
          // Update to correct mime type
          fileEntity.mimeType = detectedType.mime;
        }
      }
      
      return combinedBuffer;
    } catch (error) {
      this.logger.error(
        `Failed to combine chunks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Validate file meets requirements
   * @param file File to validate
   */
  private async validateFile(file: Express.Multer.File): Promise<void> {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File exceeds maximum size of ${this.formatBytes(this.maxFileSize)}`
      );
    }

    // Verify file type
    const detectedType = await fileType.fileTypeFromBuffer(file.buffer);
    if (!detectedType) {
      throw new BadRequestException('Could not determine file type');
    }
    
    // Check if mime type is allowed
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(detectedType.mime)) {
      throw new BadRequestException(
        `File type ${detectedType.mime} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }
    
    // Type-specific validation
    if (detectedType.mime.startsWith('image/')) {
      await this.validateImage(file);
    } else if (detectedType.mime === 'application/pdf') {
      await this.validatePdf(file);
    }
  }

  /**
   * Validate image file
   * @param file Image file
   */
  private async validateImage(file: Express.Multer.File): Promise<void> {
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('Invalid image dimensions');
      }
      
      if (
        metadata.width > this.maxImageDimension ||
        metadata.height > this.maxImageDimension
      ) {
        throw new BadRequestException(
          `Image dimensions exceed maximum allowed size of ${this.maxImageDimension}px`
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid image file: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Validate PDF file
   * @param file PDF file
   */
  private async validatePdf(file: Express.Multer.File): Promise<void> {
    try {
      const data = await pdfParse(file.buffer);
      
      if (data.numpages > this.maxPdfPages) {
        throw new BadRequestException(
          `PDF has ${data.numpages} pages, which exceeds the maximum of ${this.maxPdfPages} pages`
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid PDF file: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Process image file
   * @param file Image file
   * @param fileEntity File entity
   * @param options Processing options
   */
  private async processImage(
    file: Express.Multer.File,
    fileEntity: File,
    options: ProcessingOptions,
  ): Promise<void> {
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      
      // Store original in storage
      const originalPath = await this.storageService.uploadFileFromEntity(
        file.buffer,
        fileEntity
      );
      fileEntity.path = originalPath;
      
      // Extract metadata
      if (options.extractMetadata) {
        const imageMetadata: FileMetadata = {
          ...fileEntity.metadata,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          isProgressive: metadata.isProgressive,
        };
        fileEntity.metadata = imageMetadata;
      }
      
      // Generate optimized version
      if (options.generateThumbnails) {
        const optimized = await image
          .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
          
        const optimizedPath = await this.storageService.uploadFile(
          optimized,
          {
            path: `${fileEntity.category}/${fileEntity.id}/optimized.jpg`,
            contentType: 'image/jpeg',
          }
        );
        
        // Generate thumbnail
        const thumbnail = await image
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
          
        const thumbnailPath = await this.storageService.uploadFile(
          thumbnail,
          {
            path: `${fileEntity.category}/${fileEntity.id}/thumbnail.jpg`,
            contentType: 'image/jpeg',
          }
        );
        
        // Update file entity with versions
        fileEntity.thumbnailPath = thumbnailPath;
        fileEntity.versions = [
          {
            type: 'optimized',
            path: optimizedPath,
            size: optimized.length,
          },
        ];
        
        // Update metadata
        fileEntity.metadata = {
          ...fileEntity.metadata,
          thumbnailGenerated: true,
          optimizedGenerated: true,
        };
      }
    } catch (error) {
      this.logger.error(
        `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Process PDF file
   * @param file PDF file
   * @param fileEntity File entity
   * @param options Processing options
   */
  private async processPdf(
    file: Express.Multer.File,
    fileEntity: File,
    options: ProcessingOptions,
  ): Promise<void> {
    try {
      // Store original in storage
      const originalPath = await this.storageService.uploadFileFromEntity(
        file.buffer,
        fileEntity
      );
      fileEntity.path = originalPath;
      
      // Extract metadata if enabled
      if (options.extractMetadata) {
        const data = await pdfParse(file.buffer);
        
        fileEntity.metadata = {
          ...fileEntity.metadata,
          pageCount: data.numpages,
          pdfInfo: data.info,
          pdfMetadata: data.metadata,
          pdfVersion: data.pdfVersion,
        };
        
        // Extract text if available and not too large
        if (data.text && data.text.length < 100000) { // Don't store huge text extracts
          fileEntity.metadata.textContent = data.text;
        }
      }
      
      // Queue thumbnail generation
      if (options.generateThumbnails) {
        await this.fileQueue.add(
          'generate-pdf-thumbnail',
          {
            fileId: fileEntity.id,
            filePath: originalPath,
          },
          {
            priority: 10,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );
        
        fileEntity.metadata = {
          ...fileEntity.metadata,
          thumbnailQueued: true,
          thumbnailQueuedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(
        `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Process generic file (non-image, non-PDF)
   * @param file Generic file
   * @param fileEntity File entity
   */
  private async processGenericFile(
    file: Express.Multer.File,
    fileEntity: File,
  ): Promise<void> {
    try {
      // Just store the file
      const filePath = await this.storageService.uploadFileFromEntity(
        file.buffer,
        fileEntity
      );
      fileEntity.path = filePath;
      
      // Update metadata
      fileEntity.metadata = {
        ...fileEntity.metadata,
        processed: true,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `File storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Format bytes to human-readable string
   * @param bytes Bytes to format
   * @returns Formatted string (e.g., "5.2 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}