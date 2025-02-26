// /backend/src/monitoring/monitoring.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { SystemError } from './entities/system-error.entity';
import { MonitoringGateway } from './gateways/monitoring.gateway';
import { HealthModule } from '../common/modules/health.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemError]),
    HealthModule
  ],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    MonitoringGateway
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}