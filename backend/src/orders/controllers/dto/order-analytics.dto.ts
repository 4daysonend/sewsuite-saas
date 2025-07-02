import { ApiProperty } from '@nestjs/swagger';

export class ProductAnalytics {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'Quantity sold' })
  quantity: number;

  @ApiProperty({ description: 'Total revenue generated' })
  revenue: number;
}

// Create a class to represent the orders by status
export class OrderStatusCount {
  @ApiProperty({ example: 5 })
  pending?: number;

  @ApiProperty({ example: 10 })
  processing?: number;

  @ApiProperty({ example: 20 })
  completed?: number;

  @ApiProperty({ example: 2 })
  cancelled?: number;

  [key: string]: number | undefined;
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
    type: OrderStatusCount,
  })
  ordersByStatus: Record<string, number>;

  @ApiProperty({ description: 'Top selling products' })
  topSellingProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;

  @ApiProperty({ description: 'Time range for the analytics' })
  timeRange: {
    start: Date;
    end: Date;
  };
}
