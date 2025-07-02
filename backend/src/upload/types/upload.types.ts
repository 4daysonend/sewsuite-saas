import { File } from '../entities/file.entity';
import { Readable } from 'stream';

// This export is for backwards compatibility if you were using MulterRequest elsewhere
export { Request as MulterRequest } from 'express';

/**
 * Represents the result returned by the upload service
 */
export interface FileUploadResult {
  // The uploaded file entity
  entity?: File;

  // Alternative property name for the file entity
  file?: File;

  // Download URL for the uploaded file
  url?: string;

  // Status of the upload
  success: boolean;

  // Optional message (especially for errors)
  message?: string;

  // Any additional metadata about the upload
  metadata?: {
    processedAt?: string;
    thumbnailsGenerated?: boolean;
    originalSize?: number;
    optimizedSize?: number;
    mimeType?: string;
    [key: string]: any;
  };

  // If the upload is part of a chunked upload
  chunked?: {
    fileId: string;
    chunkNumber: number;
    totalChunks: number;
    complete: boolean;
  };
}

/**
 * Represents a file with stream that can be processed by our services
 */
export interface ProcessableFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
  fieldname: string;
  encoding: string;
  destination: string;
  filename: string;
  path: string;
  stream: Readable;
}
