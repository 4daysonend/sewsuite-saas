import { ApiProperty } from '@nestjs/swagger';

export class TopCustomer {
  @ApiProperty({ description: 'Customer ID' })
  id: string;

  @ApiProperty({ description: 'Customer name' })
  name: string;

  @ApiProperty({ description: 'Customer email' })
  email: string;

  @ApiProperty({ description: 'Number of orders' })
  orderCount: number;

  @ApiProperty({ description: 'Total spent by customer' })
  totalSpent: number;
}

export class NewCustomersMetric {
  @ApiProperty({ description: 'Count of new customers' })
  count: number;

  @ApiProperty({ description: 'Period of measurement' })
  period: string;
}

export class CustomerInsightsDto {
  @ApiProperty({ description: 'Total number of customers' })
  customerCount: number;

  @ApiProperty({ description: 'New customer metrics' })
  newCustomers: NewCustomersMetric;

  @ApiProperty({ description: 'Percentage of repeat customers' })
  repeatCustomerRate: number;

  @ApiProperty({ description: 'Average orders per customer' })
  averageOrdersPerCustomer: number;

  @ApiProperty({ description: 'Average customer value' })
  averageCustomerValue: number;

  @ApiProperty({ type: [TopCustomer], description: 'Top customers by spend' })
  topCustomers: TopCustomer[];
}
