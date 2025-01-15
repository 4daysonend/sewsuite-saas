import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { S3StorageProvider } from '../providers/s3-storage.provider';
import { FileEncryptionService } from './file-encryption.service';
import { File } from '../entities/file.entity';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageProvider: StorageProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: FileEncryptionService,
  ) {
    // Initialize the appropriate storage provider based on configuration
    this.storageProvider = new S3StorageProvider(configService);
  }

  async uploadFile(
    file: Buffer,
    fileEntity: File,
    options: { encrypt?: boolean } = {},
  ): Promise<void> {
    try {
      let fileBuffer = file;

      // Encrypt file if required
      if (options.encrypt) {
        const { encryptedData, keyId } =
          await this.encryptionService.encryptFile(file);
        fileBuffer = encryptedData;
        fileEntity.isEncrypted = true;
        fileEntity.encryptionKeyId = keyId;
      }

      // Upload file to storage
      const path = await this.storageProvider.uploadFile(
        fileBuffer,
        `${fileEntity.category}/${fileEntity.id}/${fileEntity.originalName}`,
        {
          contentType: fileEntity.mimeType,
          metadata: {
            fileId: fileEntity.id,
            category: fileEntity.category,
            encrypted: options.encrypt,
          },
        },
      );

      fileEntity.path = path;
      fileEntity.status = 'active';
    } catch (error) {
      this.logger.error(`Failed to store file: ${error.message}`);
      fileEntity.status = 'failed';
      fileEntity.processingHistory.push({
        timestamp: new Date(),
        action: 'upload',
        status: 'failed',
        error: error.message,
      });
      throw error;
    }
  }

  async getFileContent(fileEntity: File): Promise<Buffer> {
    try {
      const fileBuffer = await this.storageProvider.downloadFile(
        fileEntity.path,
      );

      if (fileEntity.isEncrypted) {
        return this.encryptionService.decryptFile(
          fileBuffer,
          fileEntity.encryptionKeyId,
        );
      }

      return fileBuffer;
    } catch (error) {
      this.logger.error(`Failed to retrieve file: ${error.message}`);
      throw error;
    }
  }

  async generateSignedUrl(fileEntity: File): Promise<string> {
    try {
      return this.storageProvider.getSignedUrl(fileEntity.path);
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileEntity: File): Promise<void> {
    try {
      await this.storageProvider.deleteFile(fileEntity.path);

      // Delete thumbnails if they exist
      if (fileEntity.thumbnailPath) {
        await this.storageProvider.deleteFile(fileEntity.thumbnailPath);
      }

      // Delete versions if they exist
      if (fileEntity.versions) {
        await Promise.all(
          fileEntity.versions.map((version) =>
            this.storageProvider.deleteFile(version.path),
          ),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }
}
