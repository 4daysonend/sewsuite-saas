import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { StorageProvider } from '../interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly s3: S3;
  private readonly bucket: string;
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
    this.bucket = this.configService.get('AWS_S3_BUCKET');
  }

  async uploadFile(file: Buffer, path: string, options?: any): Promise<string> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: path,
        Body: file,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      };

      const result = await this.s3.upload(params).promise();
      return result.Key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      throw error;
    }
  }

  async downloadFile(path: string): Promise<Buffer> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: path,
      };

      const result = await this.s3.getObject(params).promise();
      return result.Body as Buffer;
    } catch (error) {
      this.logger.error(`Failed to download file from S3: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: path,
      };

      await this.s3.deleteObject(params).promise();
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`);
      throw error;
    }
  }

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: path,
        Expires: expiresIn,
      };

      return this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`);
      throw error;
    }
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Copy the object to the new location
      await this.s3
        .copyObject({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${sourcePath}`,
          Key: destinationPath,
        })
        .promise();

      // Delete the original object
      await this.deleteFile(sourcePath);
    } catch (error) {
      this.logger.error(`Failed to move file in S3: ${error.message}`);
      throw error;
    }
  }
}
