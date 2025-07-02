import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config'; // Add this import
import { AlertService } from './services/alert.service';
import { AuditService } from './services/audit.service';
import { SystemAlert } from './entities/system-alert.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { AlertController } from '../common/controllers/alert.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemAlert, AuditLog]),
    EventEmitterModule.forRoot(),
    ConfigModule, // Add this module import
  ],
  controllers: [AlertController],
  providers: [AlertService, AuditService],
  exports: [AlertService, AuditService],
})
export class AlertModule {}
