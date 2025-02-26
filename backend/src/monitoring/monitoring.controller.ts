// /backend/src/monitoring/monitoring.controller.ts
import { 
  Controller, 
  Get, 
  Query, 
  UseGuards, 
  ValidationPipe, 
  ParseIntPipe, 
  DefaultValuePipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonitoringService } from './monitoring.service';

@ApiTags('monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get overall system metrics summary' })
  @ApiResponse({ status: 200, description: 'Returns system metrics summary' })
  async getMetricsSummary() {
    return this.monitoringService.getMetricsSummary();
  }

  @Get('metrics/errors')
  @ApiOperation({ summary: 'Get error metrics by component' })
  async getErrorMetrics(
    @Query('component') component?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.monitoringService.getErrorMetrics(component, {
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
    });
  }

  @Get('metrics/uploads')
  @ApiOperation({ summary: 'Get file upload metrics' })
  async getUploadMetrics(
    @Query('period', new DefaultValuePipe('24h')) period: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.monitoringService.getUploadMetrics({
      period,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
    });
  }

  @Get('metrics/api')
  @ApiOperation({ summary: 'Get API performance metrics' })
  async getAPIMetrics(
    @Query('path') path?: string,
    @Query('method') method?: string,
    @Query('timeframe', new DefaultValuePipe('1h')) timeframe: string,
  ) {
    return this.monitoringService.getAPIMetrics(path, method, timeframe);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get system alerts' })
  async getAlerts(
    @Query('status') status?: 'active' | 'resolved',
    @Query('severity') severity?: 'high' | 'medium' | 'low',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.monitoringService.getAlerts({ status, severity, limit });
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  async getHealthStatus() {
    return this.monitoringService.getHealthStatus();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get system performance metrics' })
  async getPerformanceMetrics(
    @Query('timeframe', new DefaultValuePipe('5m')) timeframe: string,
  ) {
    return this.monitoringService.getPerformanceMetrics(timeframe);
  }
}