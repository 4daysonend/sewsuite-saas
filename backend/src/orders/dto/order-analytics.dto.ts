import { ApiProperty } from '@nestjs/swagger';

export class TimeRange {
  @ApiProperty({ description: 'Start date of the analytics period' })
  startDate: string; // Using string format for dates

  @ApiProperty({ description: 'End date of the analytics period' })
  endDate: string;
}

export class TopSellingProduct {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'Number of items sold' })
  quantity: number;

  @ApiProperty({ description: 'Total revenue from this product' })
  revenue: number;
}

export class RevenuePeriodItem {
  @ApiProperty({ description: 'The time period' })
  period: string;

  @ApiProperty({ description: 'Revenue for the period' })
  revenue: number;

  @ApiProperty({ description: 'Number of orders in the period' })
  orderCount: number;
}

export class OrderAnalytics {
  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Total revenue' })
  totalRevenue: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({
    description: 'Orders by status',
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  ordersByStatus: Record<string, number>;

  @ApiProperty({
    description: 'Revenue by period',
    type: [RevenuePeriodItem],
  })
  revenueByPeriod: RevenuePeriodItem[];

  @ApiProperty({
    description: 'Top selling products',
    type: [TopSellingProduct],
    required: false,
  })
  topSellingProducts?: TopSellingProduct[];

  @ApiProperty({
    description: 'Time range for the analytics',
    type: TimeRange,
    required: false,
  })
  timeRange?: TimeRange;
}
