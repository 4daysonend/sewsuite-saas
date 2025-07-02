// /backend/src/upload/upload.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadQueueService } from './upload.queue';
import { UploadProcessor } from './upload.processor';
import { StorageService } from './services/storage.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'upload',
    }),
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    UploadQueueService,
    UploadProcessor,
    StorageService,
  ],
  exports: [UploadService],
})
export class UploadModule {}
