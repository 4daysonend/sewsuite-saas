import { ApiProperty } from '@nestjs/swagger';
import { Payment } from '../entities/payment.entity';

export class TransactionsResponseDto {
  @ApiProperty({
    description: 'List of payment transactions',
    type: [Payment],
  })
  data: Payment[];

  @ApiProperty({
    description: 'Total count of all matching transactions',
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
  })
  pages: number;
}
