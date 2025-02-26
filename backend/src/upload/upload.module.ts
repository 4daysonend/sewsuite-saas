// /backend/src/upload/upload.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { FileProcessingService } from './services/file-processing.service';
import { FileStorageService } from './services/file-storage.service';
import { FileEncryptionService } from './services/file-encryption.service';
import { FileProcessor } from './processors/file-processor';
import { File } from './entities/file.entity';
import { FileChunk } from './entities/file-chunk.entity';
import { StorageQuota } from './entities/storage-quota.entity';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([File, FileChunk, StorageQuota]),
    BullModule.registerQueue({
      name: 'file-processing',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      },
    }),
    ConfigModule,
    OrdersModule,
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    FileProcessingService,
    FileStorageService,
    FileEncryptionService,
    FileProcessor,
  ],
  exports: [
    UploadService,
    FileStorageService,
    FileProcessingService,
  ],
})
export class UploadModule {}