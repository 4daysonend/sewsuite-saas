// src/upload/services/storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { ConfigService } from '@nestjs/config';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const accessAsync = promisify(fs.access);

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    // Get upload directory from config or use default
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads';
    // Ensure the upload directory exists
    this.ensureUploadDirExists();
  }

  /**
   * Save a file to storage
   * @param file The file to save
   * @param fileId The ID to use for the file
   * @returns The path to the saved file
   */
  async saveFile(file: Express.Multer.File, fileId: string): Promise<string> {
    try {
      // Create directory structure
      const userDir = path.join(this.uploadDir, 'temp');
      await this.ensureDirExists(userDir);

      // Generate file path
      const extension = path.extname(file.originalname);
      const filename = `${fileId}${extension}`;
      const filePath = path.join(userDir, filename);

      // Write file to disk
      await writeFileAsync(filePath, file.buffer);

      this.logger.log(`File saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error saving file: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   * @param filePath The path to the file to delete
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await promisify(fs.unlink)(filePath);
      this.logger.log(`File deleted: ${filePath}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error deleting file: ${errorMessage}`);
      // Don't throw error for delete operations
    }
  }

  /**
   * Ensure that a directory exists
   * @param dir The directory to check/create
   */
  private async ensureDirExists(dir: string): Promise<void> {
    try {
      await accessAsync(dir, fs.constants.F_OK);
    } catch {
      // Directory doesn't exist, create it
      await mkdirAsync(dir, { recursive: true });
      this.logger.log(`Created directory: ${dir}`);
    }
  }

  /**
   * Ensure the upload directory exists
   */
  private async ensureUploadDirExists(): Promise<void> {
    await this.ensureDirExists(this.uploadDir);
  }
}
