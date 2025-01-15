import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { FileProcessingService } from './services/file-processing.service';
import { FileStorageService } from './services/file-storage.service';
import { File } from './entities/file.entity';
import { FileChunk } from './entities/file-chunk.entity';
import { StorageQuota } from './entities/storage-quota.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([File, FileChunk, StorageQuota]),
    BullModule.registerQueue({
      name: 'file-processing',
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, FileProcessingService, FileStorageService],
  exports: [UploadService, FileStorageService],
})
export class UploadModule {}
