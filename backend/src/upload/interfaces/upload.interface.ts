import { FileStatus, FileCategory } from '../entities/file.entity';

// Define the FileUploadResult interface
export interface FileUploadResult {
  id: string; // Add this property
  originalName: string;
  size: number;
  mimeType: string;
  status: FileStatus;
  category: FileCategory;
  publicUrl?: string; // Make this optional if it might not always be present
}

// Define any other interfaces needed by your upload module
export interface ChunkUploadResult {
  received: boolean;
  chunksReceived: number;
  totalChunks: number;
  complete?: boolean;
}

export interface FileStatusResult {
  status: FileStatus;
  progress: number;
  message?: string;
}

export interface StorageQuotaResult {
  used: number;
  total: number;
  available: number;
  usedFormatted: string;
  totalFormatted: string;
  availableFormatted: string;
  usagePercentage: number;
}

export interface MultipleFilesUploadResult {
  successful: FileUploadResult[];
  failed: string[];
  totalProcessed: number;
  totalFailed: number;
}
