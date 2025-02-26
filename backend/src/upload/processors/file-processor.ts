import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as sharp from 'sharp';
import * as pdfParse from 'pdf-parse';
import { File, FileStatus } from '../entities/file.entity';
import { FileStorageService } from '../services/file-storage.service';

interface GenerateThumbnailsJob {
  fileId: string;
  sizes: number[];
}

interface ExtractPdfMetadataJob {
  fileId: string;
}

interface GeneratePdfThumbnailJob {
  fileId: string;
  filePath: string;
}

@Injectable()
@Processor('file-processing')
export class FileProcessor {
  private readonly logger = new Logger(FileProcessor.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly storageService: FileStorageService,
  ) {}

  /**
   * Generate thumbnails for an image in different sizes
   * @param job Job containing file ID and sizes
   */
  @Process('generate-thumbnails')
  async generateThumbnails(job: Job<GenerateThumbnailsJob>): Promise<void> {
    const { fileId, sizes } = job.data;
    this.logger.debug(`Generating thumbnails for file: ${fileId}, sizes: ${sizes.join(', ')}`);

    try {
      // Get file
      const file = await this.fileRepository.findOne({
        where: { id: fileId }
      });

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      if (!file.mimeType.startsWith('image/')) {
        throw new Error(`File is not an image: ${fileId}`);
      }

      // Get image content
      const imageBuffer = await this.storageService.getFileContent(file);
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Generate thumbnails
      const thumbnails: { size: number; path: string; width: number; height: number }[] = [];

      for (const size of sizes) {
        // Calculate dimensions while preserving aspect ratio
        let width: number;
        let height: number;

        if (metadata.width && metadata.height) {
          if (metadata.width > metadata.height) {
            width = size;
            height = Math.round((metadata.height / metadata.width) * size);
          } else {
            height = size;
            width = Math.round((metadata.width / metadata.height) * size);
          }
        } else {
          width = size;
          height = size;
        }

        // Generate thumbnail
        const thumbnail = await image.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        }).toBuffer();

        // Upload thumbnail
        const thumbnailPath = await this.storageService.uploadFile(thumbnail, {
          path: `${file.category}/${file.id}/thumbnail_${size}.jpg`,
          contentType: 'image/jpeg',
        });

        thumbnails.push({
          size,
          path: thumbnailPath,
          width,
          height,
        });
      }

      // Update file record
      file.metadata = {
        ...file.metadata,
        thumbnails,
        thumbnailsGeneratedAt: new Date().toISOString(),
      };

      // Set main thumbnail if none exists
      if (!file.thumbnailPath && thumbnails.length > 0) {
        // Use smallest thumbnail as main
        const mainThumbnail = thumbnails.reduce((smallest, current) => 
          current.size < smallest.size ? current : smallest
        );
        file.thumbnailPath = mainThumbnail.path;
      }

      await this.fileRepository.save(file);
      this.logger.debug(`Generated ${thumbnails.length} thumbnails for file: ${fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate thumbnails: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw error;
    }
  }

  /**
   * Extract metadata from PDF file
   * @param job Job containing file ID
   */
  @Process('extract-pdf-metadata')
  async extractPdfMetadata(job: Job<ExtractPdfMetadataJob>): Promise<void> {
    const { fileId } = job.data;
    this.logger.debug(`Extracting metadata from PDF: ${fileId}`);

    try {
      // Get file
      const file = await this.fileRepository.findOne({
        where: { id: fileId }
      });

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      if (file.mimeType !== 'application/pdf') {
        throw new Error(`File is not a PDF: ${fileId}`);
      }

      // Get PDF content
      const pdfBuffer = await this.storageService.getFileContent(file);
      const pdfData = await pdfParse(pdfBuffer);

      // Extract metadata
      const metadata = {
        ...file.metadata,
        pageCount: pdfData.numpages,
        pdfInfo: pdfData.info,
        pdfMetadata: pdfData.metadata,
        pdfVersion: pdfData.pdfVersion,
        processingCompleted: true,
        processingCompletedAt: new Date().toISOString(),
      };

      // Extract text content if not too large
      if (pdfData.text && pdfData.text.length < 100000) {
        metadata.textContent = pdfData.text;
      }

      // Update file record
      file.metadata = metadata;
      await this.fileRepository.save(file);
      
      this.logger.debug(`Extracted metadata from PDF file: ${fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to extract PDF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw error;
    }
  }

  /**
   * Generate thumbnail from first page of PDF
   * @param job Job containing file ID and path
   */
  @Process('generate-pdf-thumbnail')
  async generatePdfThumbnail(job: Job<GeneratePdfThumbnailJob>): Promise<void> {
    const { fileId, filePath } = job.data;
    this.logger.debug(`Generating thumbnail for PDF: ${fileId}`);

    try {
      // Get file
      const file = await this.fileRepository.findOne({
        where: { id: fileId }
      });

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      if (file.mimeType !== 'application/pdf') {
        throw new Error(`File is not a PDF: ${fileId}`);
      }

      // For production, you would use a PDF rendering library like pdf2pic or pdf-poppler
      // For this implementation, we'll simulate PDF thumbnail generation
      
      // Create a placeholder thumbnail
      const thumbnailBuffer = await this.createPdfThumbnailPlaceholder(file.metadata?.pageCount || 1);
      
      // Upload thumbnail
      const thumbnailPath = await this.storageService.uploadFile(thumbnailBuffer, {
        path: `${file.category}/${file.id}/thumbnail.jpg`,
        contentType: 'image/jpeg',
      });

      // Update file record
      file.thumbnailPath = thumbnailPath;
      file.metadata = {
        ...file.metadata,
        thumbnailGenerated: true,
        thumbnailGeneratedAt: new Date().toISOString(),
      };

      await this.fileRepository.save(file);
      this.logger.debug(`Generated thumbnail for PDF file: ${fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate PDF thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      // Update file status but don't fail the job
      try {
        const file = await this.fileRepository.findOne({
          where: { id: fileId }
        });
        
        if (file) {
          file.metadata = {
            ...file.metadata,
            thumbnailError: error instanceof Error ? error.message : 'Unknown error',
            thumbnailErrorTime: new Date().toISOString(),
          };
          await this.fileRepository.save(file);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update file with thumbnail error: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
      }
      
      throw error;
    }
  }

  /**
   * Create placeholder thumbnail for PDF
   * @param pageCount Number of pages in PDF
   * @returns Thumbnail buffer
   */
  private async createPdfThumbnailPlaceholder(pageCount: number): Promise<Buffer> {
    // Create a placeholder image for PDF
    const width = 600;
    const height = 800;
    
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="#f0f0f0"/>
            <rect x="50" y="50" width="${width - 100}" height="${height - 100}" stroke="#cccccc" stroke-width="2" fill="#ffffff"/>
            <text x="${width/2}" y="${height/2 - 40}" font-family="Arial" font-size="24" text-anchor="middle" fill="#555555">PDF Document</text>
            <text x="${width/2}" y="${height/2 + 40}" font-family="Arial" font-size="18" text-anchor="middle" fill="#777777">${pageCount} page${pageCount !== 1 ? 's' : ''}</text>
          </svg>`,
          'utf-8'
        ),
        top: 0,
        left: 0,
      }
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
  }

  /**
   * Clean up temporary files
   * @param job Job containing file IDs to clean up
   */
  @Process('cleanup-temp-files')
  async cleanupTempFiles(job: Job<{ fileIds: string[] }>): Promise<void> {
    const { fileIds } = job.data;
    this.logger.debug(`Cleaning up temporary files for: ${fileIds.join(', ')}`);

    try {
      let successCount = 0;
      let failureCount = 0;

      for (const fileId of fileIds) {
        try {
          // Find all temporary files with this ID prefix
          const tempPath = `temp/${fileId}`;
          
          // Check if path exists and delete
          const pathExists = await this.storageService.fileExists(tempPath);
          if (pathExists) {
            await this.storageService.deleteFile(tempPath);
            successCount++;
          }
        } catch (error) {
          this.logger.warn(`Failed to clean up temp file ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          failureCount++;
        }
      }

      this.logger.debug(`Cleanup complete. Successful: ${successCount}, Failed: ${failureCount}`);
    } catch (error) {
      this.logger.error(
        `Failed to clean up temporary files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw error;
    }
  }
}