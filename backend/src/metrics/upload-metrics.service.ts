import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadMetrics } from './upload-metrics.entity';

@Injectable()
export class UploadMetricsService {
  private readonly logger = new Logger(UploadMetricsService.name);

  constructor(
    @InjectRepository(UploadMetrics)
    private metricsRepository: Repository<UploadMetrics>,
  ) {}

  async recordFileProcessing(metricData: {
    fileId: string;
    userId: string;
    fileType: string;
    fileSize: number;
    processingTimeMs: number;
    status: 'success' | 'failed';
    errorMessage?: string;
  }): Promise<UploadMetrics | null> {
    try {
      const metric = this.metricsRepository.create(metricData);
      return await this.metricsRepository.save(metric);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to record upload metrics: ${errorMessage}`,
        errorStack,
      );
      return null;
    }
  }

  async getPerformanceMetrics(days = 7): Promise<any> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const stats = await this.metricsRepository
      .createQueryBuilder('metrics')
      .select('metrics.fileType', 'fileType')
      .addSelect('AVG(metrics.processingTimeMs)', 'avgProcessingTime')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        'SUM(CASE WHEN metrics.status = :success THEN 1 ELSE 0 END)',
        'successCount',
      )
      .addSelect('SUM(metrics.fileSize)', 'totalSize')
      .where('metrics.createdAt >= :fromDate', { fromDate })
      .setParameter('success', 'success')
      .groupBy('metrics.fileType')
      .orderBy('count', 'DESC')
      .getRawMany();

    return stats;
  }

  async getDailyUploadStatistics(days = 30): Promise<any> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const stats = await this.metricsRepository
      .createQueryBuilder('metrics')
      .select('DATE(metrics.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        'SUM(CASE WHEN metrics.status = :success THEN 1 ELSE 0 END)',
        'successCount',
      )
      .addSelect('SUM(metrics.fileSize)', 'totalSize')
      .where('metrics.createdAt >= :fromDate', { fromDate })
      .setParameter('success', 'success')
      .groupBy('DATE(metrics.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return stats;
  }

  async getUserUploadStatistics(userId: string): Promise<any> {
    const stats = await this.metricsRepository
      .createQueryBuilder('metrics')
      .select('metrics.fileType', 'fileType')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(metrics.fileSize)', 'totalSize')
      .where('metrics.userId = :userId', { userId })
      .groupBy('metrics.fileType')
      .orderBy('count', 'DESC')
      .getRawMany();

    return stats;
  }
}
