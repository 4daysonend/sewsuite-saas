import { Controller, Get, Header } from '@nestjs/common';
import { MonitoringService } from '../common/services/monitoring.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  getMetrics() {
    return this.monitoringService.getMetrics();
  }
}
