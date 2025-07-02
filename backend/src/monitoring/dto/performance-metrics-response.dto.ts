// src/monitoring/dto/performance-metrics-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PerformanceMetricPoint {
  @ApiProperty({
    description: 'Timestamp for the metric point',
    example: 1634567890000,
  })
  timestamp: number;

  @ApiProperty({ description: 'Value of the metric', example: 45.7 })
  value: number;
}

export class PerformanceMetricsResponse {
  @ApiProperty({
    description: 'CPU usage percentage over time',
    type: [PerformanceMetricPoint],
  })
  cpu: PerformanceMetricPoint[];

  @ApiProperty({
    description: 'Memory usage in MB over time',
    type: [PerformanceMetricPoint],
  })
  memory: PerformanceMetricPoint[];

  @ApiProperty({
    description: 'API response times in ms over time',
    type: [PerformanceMetricPoint],
  })
  responseTime: PerformanceMetricPoint[];

  @ApiProperty({
    description: 'Database query times in ms over time',
    type: [PerformanceMetricPoint],
  })
  queryTime: PerformanceMetricPoint[];

  @ApiProperty({ description: 'Timeframe requested', example: '5m' })
  timeframe: string;
}
