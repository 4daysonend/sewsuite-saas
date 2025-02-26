// /backend/src/monitoring/services/error-logging.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemError } from '../entities/system-error.entity';

@Injectable()
export class ErrorLoggingService {
  private readonly logger = new Logger(ErrorLoggingService.name);

  constructor(
    @InjectRepository(SystemError)
    private readonly errorRepository: Repository<SystemError>,
  ) {}

  async logError(error: {
    type: string;
    message: string;
    stack?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.errorRepository.save({
        type: error.type,
        message: error.message,
        stack: error.stack,
        metadata: error.metadata,
        timestamp: new Date(),
      });
    } catch (err) {
      this.logger.error(`Failed to log error: ${err.message}`);
    }
  }

  async getErrorStats(timeframe: string): Promise<{
    errorCounts: Record<string, number>;
    trends: any[];
  }> {
    const startTime = this.getStartTime(timeframe);

    const errors = await this.errorRepository
      .createQueryBuilder('error')
      .where('error.timestamp >= :startTime', { startTime })
      .getMany();

    return {
      errorCounts: this.aggregateErrorCounts(errors),
      trends: this.calculateErrorTrends(errors),
    };
  }

  private aggregateErrorCounts(errors: SystemError[]): Record<string, number> {
    return errors.reduce(
      (acc, error) => ({
        ...acc,
        [error.type]: (acc[error.type] || 0) + 1,
      }),
      {},
    );
  }

  private calculateErrorTrends(errors: SystemError[]): any[] {
    // Group errors by hour
    const hourlyGroups = errors.reduce((acc, error) => {
      const hour = error.timestamp.getHours();
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(error);
      return acc;
    }, {});

    // Calculate trends
    return Object.entries(hourlyGroups).map(([hour, hourErrors]) => ({
      hour: parseInt(hour),
      count: hourErrors.length,
      types: this.aggregateErrorCounts(hourErrors as SystemError[]),
    }));
  }

  private getStartTime(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        now.setHours(now.getHours() - 1);
        break;
      case '24h':
        now.setDate(now.getDate() - 1);
        break;
      case '7d':
        now.setDate(now.getDate() - 7);
        break;
      case '30d':
        now.setDate(now.getDate() - 30);
        break;
    }
    return now;
  }
}