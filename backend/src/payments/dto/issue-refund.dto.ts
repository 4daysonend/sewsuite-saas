// filepath: c:\Users\PSXLHP276\sewsuite-saas\backend\src\payments\dto\issue-refund.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';

export class IssueRefundDto {
  @ApiPropertyOptional({
    description:
      'Amount to refund in cents. If not provided, refunds the entire amount.',
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  amount?: number;

  @ApiProperty({
    description: 'Reason for the refund',
    enum: ['requested_by_customer', 'duplicate', 'fraudulent', 'other'],
  })
  @IsEnum(['requested_by_customer', 'duplicate', 'fraudulent', 'other'])
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other';

  @ApiPropertyOptional({ description: 'Additional notes about the refund' })
  @IsString()
  @IsOptional()
  notes?: string;
}
