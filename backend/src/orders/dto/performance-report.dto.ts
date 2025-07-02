import { ApiProperty } from '@nestjs/swagger';

export class PerformanceReportDto {
  @ApiProperty({ description: 'Percentage of completed orders' })
  completionRate: number;

  @ApiProperty({
    description: 'Average time to complete an order (in seconds)',
  })
  averageCompletionTime: number;

  @ApiProperty({ description: 'Percentage of cancelled orders' })
  cancellationRate: number;

  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Number of completed orders' })
  completedOrders: number;

  @ApiProperty({ description: 'Number of cancelled orders' })
  cancelledOrders: number;
}
