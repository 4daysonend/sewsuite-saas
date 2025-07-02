import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for Monthly Recurring Revenue (MRR) analytics
 */
export class MRRDataDto {
  @ApiProperty({
    description: 'Date for which the MRR data is calculated',
    example: '2023-01-01',
  })
  date: string;

  @ApiProperty({
    description: 'Total Monthly Recurring Revenue for the date',
    example: 5000,
  })
  mrr: number;

  @ApiProperty({
    description: 'Net new MRR (new subscriptions minus churned subscriptions)',
    example: 250,
  })
  netNewMRR: number;

  @ApiProperty({
    description: 'MRR from new customers',
    example: 1000,
  })
  newMRR: number;

  @ApiProperty({
    description: 'MRR from existing customer upgrades/expansions',
    example: 500,
  })
  expansionMRR: number;

  @ApiProperty({
    description: 'MRR lost from canceled subscriptions',
    example: 750,
  })
  churnMRR: number;

  @ApiProperty({
    description: 'MRR lost from downgrades',
    example: 500,
    required: false,
  })
  contractionMRR?: number;

  @ApiProperty({
    description: 'MRR from reactivated customers',
    example: 250,
    required: false,
  })
  reactivationMRR?: number;
}
