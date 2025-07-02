import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadMetrics } from './upload-metrics.entity';
import { UploadMetricsService } from './upload-metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([UploadMetrics])],
  providers: [UploadMetricsService],
  exports: [UploadMetricsService],
})
export class MetricsModule {}
