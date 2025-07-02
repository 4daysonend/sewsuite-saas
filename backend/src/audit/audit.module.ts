// src/audit/audit.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLogService } from './audit-log.service';
import { AuditEntry } from './entities/audit-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEntry])],
  providers: [AuditService, AuditLogService],
  exports: [AuditService, AuditLogService],
})
export class AuditModule {}
