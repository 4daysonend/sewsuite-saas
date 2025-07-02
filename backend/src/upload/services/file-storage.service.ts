import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { S3StorageProvider } from '../providers/s3-storage.provider';
import { FileEncryptionService } from './file-encryption.service';
import { File, FileStatus } from '../entities/file.entity';

interface FileUploadOptions {
  path?: string;
  encrypt?: boolean;
  contentType?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageProvider: StorageProvider;
  private readonly urlExpirationMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: FileEncryptionService,
  ) {
    // Initialize storage provider based on config
    const storageType = this.configService.get<string>(
      'STORAGE_PROVIDER',
      's3',
    );

    switch (storageType) {
      case 's3':
      default:
        this.storageProvider = new S3StorageProvider(configService);
    }

    this.urlExpirationMinutes = this.configService.get<number>(
      'SIGNED_URL_EXPIRATION_MINUTES',
      15,
    );
  }

  /**
   * Upload file to storage
   * @param fileBuffer File content buffer
   * @param options Upload options
   * @returns Path to uploaded file
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: FileUploadOptions = {},
  ): Promise<string> {
    try {
      let buffer = fileBuffer;
      const metadata: Record<string, any> = { ...options.metadata };

      // Encrypt file if required
      if (options.encrypt) {
        const { encryptedData, keyId } =
          await this.encryptionService.encryptFile(fileBuffer);
        buffer = encryptedData;
        metadata.encrypted = true;
        metadata.encryptionKeyId = keyId;
      }

      // Generate path if not provided
      const path =
        options.path || this.generateStoragePath(options.contentType);

      // Upload file to storage
      await this.storageProvider.uploadFile(buffer, path, {
        contentType: options.contentType,
        metadata,
      });

      return path;
    } catch (error) {
      this.logger.error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Upload file from file entity
   * @param file File buffer
   * @param fileEntity File entity
   * @param options Upload options
   * @returns Path to uploaded file
   */
  async uploadFileFromEntity(
    file: Buffer,
    fileEntity: File,
    options: { encrypt?: boolean } = {},
  ): Promise<string> {
    try {
      const path = `${fileEntity.category}/${fileEntity.id}/${fileEntity.originalName}`;

      let fileBuffer = file;
      let encryptionKeyId: string | undefined;

      // Encrypt file if required
      if (options.encrypt) {
        const encryptionResult = await this.encryptionService.encryptFile(file);
        fileBuffer = encryptionResult.encryptedData;
        encryptionKeyId = encryptionResult.keyId;
      }

      // Upload file to storage
      await this.storageProvider.uploadFile(fileBuffer, path, {
        contentType: fileEntity.mimeType,
        metadata: {
          fileId: fileEntity.id,
          category: fileEntity.category,
          encrypted: options.encrypt || false,
        },
      });

      // Update file entity
      fileEntity.path = path;
      fileEntity.status = FileStatus.ACTIVE;

      if (options.encrypt) {
        fileEntity.isEncrypted = true;
        fileEntity.encryptionKeyId = encryptionKeyId;
      }

      return path;
    } catch (error) {
      this.logger.error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      fileEntity.status = FileStatus.FAILED;
      fileEntity.metadata = {
        ...fileEntity.metadata,
        uploadError: error instanceof Error ? error.message : 'Unknown error',
        uploadErrorTime: new Date().toISOString(),
      };

      throw error;
    }
  }

  /**
   * Get file content from storage
   * @param file File or path to retrieve
   * @returns File buffer
   */
  async getFileContent(
    file:
      | File
      | { path: string; isEncrypted?: boolean; encryptionKeyId?: string },
  ): Promise<Buffer> {
    try {
      if (!file.path) {
        throw new Error('File path is required');
      }

      const fileBuffer = await this.storageProvider.downloadFile(file.path);

      if (file.isEncrypted && file.encryptionKeyId) {
        return this.encryptionService.decryptFile(
          fileBuffer,
          file.encryptionKeyId,
        );
      }

      return fileBuffer;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Generate signed URL for file download
   * @param file File to generate URL for
   * @param expiresInMinutes URL expiration time in minutes
   * @returns Signed URL and expiration date
   */
  async generateSignedUrl(
    file: File | { path: string | null },
    expiresInMinutes?: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    try {
      if (!file.path) {
        throw new Error('File path is required for generating a signed URL');
      }

      const expiration = expiresInMinutes || this.urlExpirationMinutes;
      const expirationSeconds = expiration * 60;

      const url = await this.storageProvider.getSignedUrl(
        file.path,
        expirationSeconds,
      );

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiration);

      return { url, expiresAt };
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Move file to a new location
   * @param file File to move
   * @param newPath Destination path
   */
  async moveFile(file: File, newPath: string): Promise<void> {
    try {
      if (!file.path) {
        throw new Error('File path is required for moving a file');
      }
      await this.storageProvider.moveFile(file.path, newPath);
      file.path = newPath;
    } catch (error) {
      this.logger.error(
        `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Delete file from storage
   * @param file File to delete
   */
  async deleteFile(file: File | { path: string | null }): Promise<void> {
    try {
      if (file.path) {
        await this.storageProvider.deleteFile(file.path);
      }

      // Delete thumbnails if they exist (for File entities)
      if ('thumbnailPath' in file && file.thumbnailPath) {
        await this.storageProvider.deleteFile(file.thumbnailPath);
      }

      // Delete versions if they exist (for File entities)
      if ('versions' in file && file.versions && file.versions.length > 0) {
        await Promise.all(
          file.versions.map((version) =>
            this.storageProvider.deleteFile(version.path),
          ),
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Generate unique storage path for a file
   * @param contentType Optional content type
   * @returns Generated path
   */
  private generateStoragePath(contentType?: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const uuid = crypto.randomUUID();
    const extension = this.getExtensionFromContentType(contentType);

    return `uploads/${year}/${month}/${day}/${uuid}${extension ? `.${extension}` : ''}`;
  }

  /**
   * Get file extension from content type
   * @param contentType MIME type
   * @returns File extension or empty string
   */
  private getExtensionFromContentType(contentType?: string): string {
    if (!contentType) return '';

    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'xlsx',
    };

    return extensionMap[contentType] || '';
  }

  /**
   * Check if a file exists at the given path
   * @param tempPath Path to check
   * @returns Boolean indicating if file exists
   */
  async fileExists(tempPath: string): Promise<boolean> {
    try {
      return await this.storageProvider.fileExists(tempPath);
    } catch (error) {
      this.logger.error(
        `Error checking if file exists at path '${tempPath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
