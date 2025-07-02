import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLog } from './entities/error-log.entity';

interface CreateErrorLogDto {
  source: string;
  message: string;
  stack?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface FindErrorLogOptions {
  source?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ErrorLogService {
  constructor(
    @InjectRepository(ErrorLog)
    private errorLogRepository: Repository<ErrorLog>,
  ) {}

  /**
   * Create a new error log entry
   */
  async create(createErrorLogDto: CreateErrorLogDto): Promise<ErrorLog> {
    const errorLog = this.errorLogRepository.create({
      source: createErrorLogDto.source,
      message: createErrorLogDto.message,
      stack: createErrorLogDto.stack,
      userId: createErrorLogDto.userId,
      metadata: createErrorLogDto.metadata,
    });

    return await this.errorLogRepository.save(errorLog);
  }

  /**
   * Find error logs by various criteria
   */
  async findAll(options: FindErrorLogOptions = {}): Promise<ErrorLog[]> {
    const query = this.errorLogRepository.createQueryBuilder('error_log');

    if (options.source) {
      query.andWhere('error_log.source = :source', { source: options.source });
    }

    if (options.userId) {
      query.andWhere('error_log.userId = :userId', { userId: options.userId });
    }

    if (options.startDate) {
      query.andWhere('error_log.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      query.andWhere('error_log.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    query.orderBy('error_log.createdAt', 'DESC');

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    return await query.getMany();
  }

  /**
   * Find an error log by ID
   */
  async findOne(id: string): Promise<ErrorLog | null> {
    return await this.errorLogRepository.findOne({ where: { id } });
  }

  /**
   * Delete old error logs to prevent database bloat
   * @param olderThan Date before which logs should be deleted
   */
  async deleteOld(olderThan: Date): Promise<number> {
    const result = await this.errorLogRepository
      .createQueryBuilder()
      .delete()
      .from(ErrorLog)
      .where('createdAt < :olderThan', { olderThan })
      .execute();

    return result.affected || 0;
  }

  /**
   * Log an error with details and metadata
   */
  async logError({
    source,
    message,
    details,
    stack,
    metadata,
  }: {
    source: string;
    message: string;
    details: string;
    stack: string | undefined;
    metadata: { fileId: string; userId: string; jobId: string };
  }): Promise<ErrorLog> {
    const errorLog = await this.create({
      source,
      message: `${message}: ${details}`,
      stack,
      userId: metadata.userId,
      metadata,
    });

    return errorLog;
  }

  /**
   * Get error frequency statistics
   * Returns the count of errors grouped by source for the specified time period
   */
  async getErrorStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{ source: string; count: number }[]> {
    const stats = await this.errorLogRepository
      .createQueryBuilder('error_log')
      .select('error_log.source', 'source')
      .addSelect('COUNT(error_log.id)', 'count')
      .where('error_log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('error_log.source')
      .orderBy('count', 'DESC')
      .getRawMany();

    return stats.map((item) => ({
      source: item.source,
      count: parseInt(item.count, 10),
    }));
  }
}
