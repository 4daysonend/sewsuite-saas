// /backend/src/upload/providers/s3-storage.provider.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, StorageOptions } from '../interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly baseUrl: string;
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    
    if (!this.bucket) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }
    
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are not configured');
    }
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    
    this.baseUrl = this.configService.get<string>(
      'AWS_S3_BASE_URL',
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`
    );
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    file: Buffer,
    path: string,
    options?: StorageOptions,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file,
        ContentType: options?.contentType,
        Metadata: this.serializeMetadata(options?.metadata),
      });
      
      await this.s3Client.send(command);
      return path;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Download file from S3
   */
  async downloadFile(path: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });
      
      const response = await this.s3Client.send(command);
      
      const chunks: Uint8Array[] = [];
      
      // @ts-expect-error - Body is a Readable stream
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(
        `Failed to download file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });
      
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get signed URL for file download
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });
      
      return getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Move/copy file in S3
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourcePath}`,
        Key: destinationPath,
      });
      
      await this.s3Client.send(copyCommand);
      await this.deleteFile(sourcePath);
    } catch (error) {
      this.logger.error(
        `Failed to move file in S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Verify if file exists in S3
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  private serializeMetadata(metadata?: Record<string, any>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null) continue;
      
      if (typeof value === 'object') {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }
    
    return result;
  }
}