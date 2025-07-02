import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { CommonModule } from '../common/common.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './services/monitoring.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { SmtpHealthCollector } from './collectors/smtp-health.collector';
import { BullQueueCollector } from './collectors/bull-queue.collector';
import { ApiMetric } from './entities/api-metric.entity';
import { SystemMetric } from './entities/system-metric.entity';
import { SystemError } from './entities/system-error.entity';
import { Alert } from './entities/alert.entity';
import { FileUpload } from './entities/file-upload.entity';
import { HealthService } from './health/health.service';
import { MetricsCacheService } from './services/metrics-cache.service';
import { MonitoringGateway } from './gateways/monitoring.gateway';
import { PrometheusMetricsInterceptor } from '../monitoring/promethus-metrics.interceptor';
import { Controller, UseInterceptors } from '@nestjs/common';

@Controller('api/v1/users')
@UseInterceptors(PrometheusMetricsInterceptor)
export class UsersController {
  // Controller methods
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiMetric,
      Alert,
      SystemMetric,
      SystemError,
      FileUpload,
    ]),
    CommonModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue(
      {
        name: 'email',
      },
      {
        name: 'email-dlq',
      },
    ),
  ],
  controllers: [MonitoringController, MetricsController],
  providers: [
    MonitoringService,
    HealthService,
    MetricsCacheService,
    MonitoringGateway,
    MetricsService,
    SmtpHealthCollector,
    BullQueueCollector,
    PrometheusMetricsInterceptor,
  ],
  exports: [MonitoringService, MetricsService],
})
export class MonitoringModule {}
