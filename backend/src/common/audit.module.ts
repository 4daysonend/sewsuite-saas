import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditService } from './services/audit.service';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    ConfigModule, // Make sure this is here
  ],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
