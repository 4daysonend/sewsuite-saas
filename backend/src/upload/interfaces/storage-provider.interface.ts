// /backend/src/upload/interfaces/storage-provider.interface.ts

/**
 * Storage options for file uploads
 */
export interface StorageOptions {
  /**
   * Content type (MIME type) of the file
   */
  contentType?: string;
  
  /**
   * Metadata to store with the file
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for storage providers (S3, local, etc.)
 */
export interface StorageProvider {
  /**
   * Upload file to storage
   */
  uploadFile(
    file: Buffer,
    path: string,
    options?: StorageOptions,
  ): Promise<string>;

  /**
   * Download file from storage
   */
  downloadFile(path: string): Promise<Buffer>;

  /**
   * Delete file from storage
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Get signed URL for file download
   */
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;

  /**
   * Move/copy file to new location
   */
  moveFile(sourcePath: string, destinationPath: string): Promise<void>;
}