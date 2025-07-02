// src/payments/dto/refund-payment.dto.ts
import {
  IsOptional,
  IsNumber,
  IsString,
  IsObject,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiPropertyOptional({
    description: 'Amount to refund (defaults to full payment amount)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for the refund',
    enum: ['requested_by_customer', 'duplicate', 'fraudulent', 'abandoned'],
    default: 'requested_by_customer',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['requested_by_customer', 'duplicate', 'fraudulent', 'abandoned'])
  reason?: string = 'requested_by_customer';

  @IsOptional()
  @IsString()
  notes?: string; // Add this property

  @ApiPropertyOptional({ description: 'Additional metadata for the refund' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
