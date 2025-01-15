import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  priceId: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  trialDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  couponCode?: string;
}
