import { ApiProperty } from '@nestjs/swagger';

export class ChurnDataDto {
  @ApiProperty({ description: 'Period type (daily, weekly, monthly)' })
  period: string;

  @ApiProperty({ description: 'Date for this data point' })
  date: string;

  @ApiProperty({ description: 'Total number of customers in this period' })
  totalCustomers: number;

  @ApiProperty({
    description: 'Number of customers who churned in this period',
  })
  churnedCustomers: number;

  @ApiProperty({
    description: 'Churn rate as a decimal (0.05 = 5%)',
    minimum: 0,
    maximum: 1,
  })
  churnRate: number;
}
