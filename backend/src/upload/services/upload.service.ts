import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { File, FileStatus } from '../entities/file.entity';
import { FileChunk } from '../entities/file-chunk.entity';
import { StorageQuota } from '../entities/storage-quota.entity';
import { FileProcessingService } from './file-processing.service';
import { FileStorageService } from './file-storage.service';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ChunkUploadDto } from '../dto/chunk-upload.dto';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(FileChunk)
    private readonly fileChunkRepository: Repository<FileChunk>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
    private readonly processingService: FileProcessingService,
    private readonly storageService: FileStorageService,
    @InjectQueue('file-processing')
    private readonly processingQueue: Queue,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    uploadFileDto: UploadFileDto,
    user: User,
  ): Promise<File> {
    // Check quota before proceeding
    await this.checkQuota(user, file.size);

    // Create file entity
    const fileEntity = this.fileRepository.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category: uploadFileDto.category,
      status: FileStatus.PENDING,
      uploader: user,
      metadata: {
        tags: uploadFileDto.tags,
        description: uploadFileDto.description,
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
      await this.updateQuota(user, file.size);

      // Save updated file entity
      return this.fileRepository.save(fileEntity);
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      fileEntity.status = FileStatus.FAILED;
      await this.fileRepository.save(fileEntity);
      throw error;
    }
  }

  async handleChunkUpload(
    chunk: Express.Multer.File,
    chunkUploadDto: ChunkUploadDto,
    user: User,
  ): Promise<{ received: boolean }> {
    const { fileId, chunkNumber, totalChunks } = chunkUploadDto;

    // Get or create file entity
    const fileEntity = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader'],
    });

    if (!fileEntity) {
      throw new NotFoundException('File not found');
    }

    if (fileEntity.uploader.id !== user.id) {
      throw new BadRequestException(
        'Unauthorized to upload chunks for this file',
      );
    }

    // Store chunk
    const chunkEntity = this.fileChunkRepository.create({
      fileId,
      chunkNumber,
      size: chunk.size,
      path: `${fileId}/chunks/${chunkNumber}`,
    });

    // Store chunk in temporary storage
    await this.storageService.uploadFile(chunk.buffer, {
      ...chunkEntity,
      category: 'temp',
    } as any);

    await this.fileChunkRepository.save(chunkEntity);

    // Check if all chunks are received
    const receivedChunks = await this.fileChunkRepository.count({
      where: { fileId },
    });

    return { received: receivedChunks === totalChunks };
  }

  async completeChunkedUpload(fileId: string, user: User): Promise<File> {
    const fileEntity = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader'],
    });

    if (!fileEntity) {
      throw new NotFoundException('File not found');
    }

    if (fileEntity.uploader.id !== user.id) {
      throw new BadRequestException('Unauthorized to complete this upload');
    }

    try {
      // Get all chunks
      const chunks = await this.fileChunkRepository.find({
        where: { fileId },
        order: { chunkNumber: 'ASC' },
      });

      // Combine chunks
      const completeFile = await this.combineChunks(chunks);

      // Process combined file
      await this.processingService.processFile(
        { buffer: completeFile } as Express.Multer.File,
        fileEntity,
      );

      // Clean up chunks
      await Promise.all(
        chunks.map((chunk) => this.storageService.deleteFile(chunk as any)),
      );
      await this.fileChunkRepository.delete({ fileId });

      // Update quota
      await this.updateQuota(user, fileEntity.size);

      return this.fileRepository.save(fileEntity);
    } catch (error) {
      this.logger.error(`Failed to complete chunked upload: ${error.message}`);
      fileEntity.status = FileStatus.FAILED;
      await this.fileRepository.save(fileEntity);
      throw error;
    }
  }

  private async combineChunks(chunks: FileChunk[]): Promise<Buffer> {
    const buffers = await Promise.all(
      chunks.map((chunk) =>
        this.storageService.getFileContent({ path: chunk.path } as any),
      ),
    );
    return Buffer.concat(buffers);
  }

  async getDownloadUrl(fileId: string, user: User): Promise<{ url: string }> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader', 'order', 'order.client', 'order.tailor'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check access permissions
    this.checkFileAccess(file, user);

    const url = await this.storageService.generateSignedUrl(file);
    return { url };
  }

  private checkFileAccess(file: File, user: User): void {
    const hasAccess =
      file.uploader.id === user.id ||
      file.order?.client.id === user.id ||
      file.order?.tailor.id === user.id;

    if (!hasAccess) {
      throw new BadRequestException('Unauthorized to access this file');
    }
  }

  async getUserFiles(
    user: User,
    category?: string,
    pagination = { page: 1, limit: 10 },
  ): Promise<{ files: File[]; total: number }> {
    const query = this.fileRepository
      .createQueryBuilder('file')
      .where('file.uploader = :userId', { userId: user.id })
      .andWhere('file.status = :status', { status: FileStatus.ACTIVE });

    if (category) {
      query.andWhere('file.category = :category', { category });
    }

    const [files, total] = await query
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();

    return { files, total };
  }

  async deleteFile(fileId: string, user: User): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploader'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.uploader.id !== user.id) {
      throw new BadRequestException('Unauthorized to delete this file');
    }

    await this.storageService.deleteFile(file);
    await this.fileRepository.softDelete(fileId);
    await this.updateQuota(user, -file.size);
  }

  private async checkQuota(user: User, fileSize: number): Promise<void> {
    const quota = await this.getStorageQuota(user);
    if (quota.used + fileSize > quota.total) {
      throw new BadRequestException('Storage quota exceeded');
    }
  }

  private async updateQuota(user: User, size: number): Promise<void> {
    await this.quotaRepository.increment(
      { user: { id: user.id } },
      'usedSpace',
      size,
    );
  }

  async getStorageQuota(user: User): Promise<{
    used: number;
    total: number;
    percentage: number;
  }> {
    const quota = await this.quotaRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!quota) {
      throw new NotFoundException('Storage quota not found');
    }

    return {
      used: quota.usedSpace,
      total: quota.totalSpace,
      percentage: (quota.usedSpace / quota.totalSpace) * 100,
    };
  }
}
