import { ApiProperty } from '@nestjs/swagger';
import { PeriodType } from '../types/period.type';

export class RevenueTrendItem {
  @ApiProperty({ description: 'The time period (date, week or month)' })
  period: string;

  @ApiProperty({ description: 'Revenue for the period' })
  revenue: number;

  @ApiProperty({ description: 'Number of orders in the period' })
  orderCount: number;
}

export class RevenueTrendsDto {
  @ApiProperty({
    description: 'Revenue trends over time',
    type: [RevenueTrendItem],
  })
  trends: RevenueTrendItem[];

  @ApiProperty({
    description: 'Period type used for aggregation',
    enum: PeriodType,
  })
  period: PeriodType;

  @ApiProperty({ description: 'Start date of the trend period' })
  startDate: string;

  @ApiProperty({ description: 'End date of the trend period' })
  endDate: string;
}
