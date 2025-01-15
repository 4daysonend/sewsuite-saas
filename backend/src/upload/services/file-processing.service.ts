import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as sharp from 'sharp';
import * as FileType from 'file-type';
import * as ClamAV from 'clamav.js';
import * as pdf from 'pdf-parse';
import { File, FileStatus } from '../entities/file.entity';
import { FileStorageService } from './file-storage.service';

@Injectable()
export class FileProcessingService {
  private readonly logger = new Logger(FileProcessingService.name);
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;
  private readonly virusScanner: typeof ClamAV;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: FileStorageService,
    @InjectQueue('file-processing') private readonly fileQueue: Queue,
  ) {
    this.allowedMimeTypes = this.configService
      .get('ALLOWED_MIME_TYPES')
      .split(',');
    this.maxFileSize = this.configService.get('MAX_FILE_SIZE');
    this.initializeVirusScanner();
  }

  private async initializeVirusScanner() {
    this.virusScanner = await ClamAV.createScanner({
      removeInfected: true,
      quarantineInfected: true,
      scanLog: null,
      debugMode: false,
    });
  }

  private async validateFile(file: Express.Multer.File): Promise<void> {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.maxFileSize} bytes`,
      );
    }

    // Verify actual file type
    const fileType = await FileType.fromBuffer(file.buffer);
    if (!fileType || !this.allowedMimeTypes.includes(fileType.mime)) {
      throw new BadRequestException('Invalid or unsupported file type');
    }

    // Additional validation for specific file types
    if (file.mimetype.startsWith('image/')) {
      await this.validateImage(file);
    } else if (file.mimetype === 'application/pdf') {
      await this.validatePDF(file);
    }
  }

  private async validateImage(file: Express.Multer.File): Promise<void> {
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      // Check image dimensions
      const maxDimension = this.configService.get('MAX_IMAGE_DIMENSION');
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        throw new BadRequestException(
          `Image dimensions exceed maximum limit of ${maxDimension}px`,
        );
      }

      // Check for valid color space
      const allowedColorSpaces = ['srgb', 'cmyk', 'gray'];
      if (!allowedColorSpaces.includes(metadata.space)) {
        throw new BadRequestException('Invalid image color space');
      }
    } catch (error) {
      throw new BadRequestException('Invalid image file');
    }
  }

  private async validatePDF(file: Express.Multer.File): Promise<void> {
    try {
      const data = await pdf(file.buffer);
      const maxPages = this.configService.get('MAX_PDF_PAGES');

      if (data.numpages > maxPages) {
        throw new BadRequestException(
          `PDF exceeds maximum page limit of ${maxPages}`,
        );
      }
    } catch (error) {
      throw new BadRequestException('Invalid PDF file');
    }
  }

  private async scanFile(buffer: Buffer): Promise<void> {
    const isInfected = await this.virusScanner.isInfected(buffer);
    if (isInfected) {
      throw new BadRequestException('File contains malware');
    }
  }

  private async processImage(
    file: Express.Multer.File,
    fileEntity: File,
  ): Promise<void> {
    const image = sharp(file.buffer);
    const metadata = await image.metadata();

    // Generate optimized version
    const optimized = await image
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    // Generate thumbnail
    const thumbnail = await image
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Store original file
    const originalPath = await this.storageService.uploadFile(
      file.buffer,
      fileEntity,
    );

    // Store optimized version
    const optimizedPath = await this.storageService.uploadFile(optimized, {
      ...fileEntity,
      path: `${fileEntity.id}/optimized`,
    });

    // Store thumbnail
    const thumbnailPath = await this.storageService.uploadFile(thumbnail, {
      ...fileEntity,
      path: `${fileEntity.id}/thumbnail`,
    });

    // Update file entity with paths and metadata
    fileEntity.path = originalPath;
    fileEntity.versions = [
      { type: 'optimized', path: optimizedPath, size: optimized.length },
    ];
    fileEntity.thumbnailPath = thumbnailPath;
    fileEntity.metadata = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
    };
  }

  private async processPDF(
    file: Express.Multer.File,
    fileEntity: File,
  ): Promise<void> {
    // Extract PDF metadata
    const data = await pdf(file.buffer);

    // Store original file
    const filePath = await this.storageService.uploadFile(
      file.buffer,
      fileEntity,
    );

    // Update file entity with metadata
    fileEntity.path = filePath;
    fileEntity.metadata = {
      pageCount: data.numpages,
      info: data.info,
      metadata: data.metadata,
    };

    // Queue thumbnail generation for the first page
    await this.fileQueue.add('generate-pdf-thumbnail', {
      fileId: fileEntity.id,
      filePath,
    });
  }

  async processChunkedUpload(
    chunks: Buffer[],
    fileEntity: File,
  ): Promise<void> {
    // Combine chunks
    const completeFile = Buffer.concat(chunks);

    // Process the complete file
    await this.processFile(
      { buffer: completeFile } as Express.Multer.File,
      fileEntity,
    );
  }

  async generatePDFThumbnail(
    filePath: string,
    fileEntity: File,
  ): Promise<void> {
    try {
      // Implementation for PDF thumbnail generation
      // This would typically use a library like pdf2img or similar
      this.logger.log(`Generating thumbnail for PDF: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to generate PDF thumbnail: ${error.message}`);
    }
  }
}
