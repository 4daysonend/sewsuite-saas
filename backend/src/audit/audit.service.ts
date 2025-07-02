// src/audit/audit.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEntry } from './entities/audit-entry.entity';
import { CreateAuditEntryDto } from './dto/create-audit-entry.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEntry)
    private readonly auditRepository: Repository<AuditEntry>,
  ) {}

  /**
   * Log an audit entry
   */
  async log(createAuditEntryDto: CreateAuditEntryDto): Promise<AuditEntry> {
    try {
      const auditEntry = this.auditRepository.create(createAuditEntryDto);
      return await this.auditRepository.save(auditEntry);
    } catch (error) {
      // Don't throw errors from audit service to prevent disrupting main application flow
      this.logger.error(
        `Failed to create audit entry: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      // Return a partially constructed audit entry for error handling purposes
      // Option 1: Spread first, then override specific properties
      return {
        ...createAuditEntryDto,
        id: 'error',
        createdAt: new Date(),
      } as AuditEntry;
    }
  }

  /**
   * Find audit entries by user ID
   */
  async findByUserId(userId: string): Promise<AuditEntry[]> {
    return this.auditRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find audit entries by target (e.g., resource ID and type)
   */
  async findByTarget(
    targetId: string,
    targetType: string,
  ): Promise<AuditEntry[]> {
    return this.auditRepository.find({
      where: { targetId, targetType },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find audit entries by action
   */
  async findByAction(action: string): Promise<AuditEntry[]> {
    return this.auditRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
    });
  }
}
