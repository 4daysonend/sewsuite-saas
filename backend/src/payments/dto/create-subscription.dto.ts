// /backend/src/payments/dto/create-subscription.dto.ts
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Stripe price ID' })
  @IsString()
  priceId = '';

  @ApiPropertyOptional({ description: 'Trial period in days' })
  @IsOptional()
  @IsNumber()
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Stripe coupon code' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}