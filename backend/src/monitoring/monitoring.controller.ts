// /backend/src/monitoring/monitoring.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  ValidationPipe,
  ParseIntPipe,
  DefaultValuePipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonitoringService } from './services/monitoring.service';
import { MetricQueryDto } from './dto/metric-query.dto';
import { PerformanceMetricsResponse } from './dto/performance-metrics-response.dto';

@ApiTags('monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin') // Adding superadmin role
export class MonitoringController {
  private readonly logger = new Logger(MonitoringController.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get overall system metrics summary' })
  @ApiResponse({ status: 200, description: 'Returns system metrics summary' })
  async getMetricsSummary() {
    return this.monitoringService.getMetricsSummary();
  }

  @Get('metrics')
  async getMetrics(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    // limit will be parsed as a number
    return this.monitoringService.getMetrics({
      timeframe: `last${limit}Minutes`,
    });
  }

  @Get('metrics/errors')
  @ApiOperation({ summary: 'Get error metrics by component' })
  async getErrorMetrics(@Query() query: MetricQueryDto) {
    return this.monitoringService.getErrorMetrics(query);
  }

  @Get('metrics/uploads')
  @ApiOperation({ summary: 'Get file upload metrics' })
  async getUploadMetrics(@Query() query: MetricQueryDto) {
    // Transform the DTO into the expected format
    const options = {
      period: query.timeframe || '24h', // Use timeframe as period or default to '24h'
      startTime: query.startTime,
      endTime: query.endTime,
    };

    return this.monitoringService.getUploadMetrics(options);
  }

  @Get('metrics/api')
  @ApiOperation({ summary: 'Get API performance metrics' })
  async getAPIMetrics(@Query() query: MetricQueryDto) {
    return this.monitoringService.getAPIMetrics(query);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get system alerts' })
  async getAlerts(@Query() query: MetricQueryDto) {
    return this.monitoringService.getAlerts(query);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  async getHealthStatus() {
    return this.monitoringService.getHealthStatus();
  }

  /**
   * Retrieves system performance metrics for a specified timeframe
   *
   * @param timeframe Human-readable time period (e.g., "5m", "1h", "7d")
   * @returns System performance metrics including CPU, memory usage, and request statistics
   *
   * @example
   * GET /monitoring/performance?timeframe=30m
   */
  @Get('performance')
  @ApiOperation({ summary: 'Get system performance metrics' })
  @ApiQuery({
    name: 'timeframe',
    description: 'Time period (5m = 5 minutes, 1h = 1 hour, 7d = 7 days)',
    required: false,
    type: String,
    example: '5m',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns system performance metrics',
    type: PerformanceMetricsResponse,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getPerformanceMetrics(
    @Query('timeframe', new DefaultValuePipe('5m')) timeframe: string,
  ) {
    const timeframeMs = this.parseTimeframe(timeframe);
    return this.monitoringService.getPerformanceMetrics(timeframe, timeframeMs);
  }

  private parseTimeframe(timeframe: string): number {
    const unit = timeframe.charAt(timeframe.length - 1);
    const value = parseInt(timeframe.slice(0, -1), 10);

    switch (unit) {
      case 'm': // minutes
        return value * 60 * 1000;
      case 'h': // hours
        return value * 60 * 60 * 1000;
      case 'd': // days
        return value * 24 * 60 * 60 * 1000;
      default:
        this.logger.warn(
          `Invalid timeframe format: ${timeframe}, using default of 5m`,
        );
        return 5 * 60 * 1000; // Default to 5 minutes
    }
  }
}
