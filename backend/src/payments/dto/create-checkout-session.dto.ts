import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CheckoutMode {
  PAYMENT = 'payment',
  SUBSCRIPTION = 'subscription',
  SETUP = 'setup',
}

export class LineItemDto {
  @ApiProperty({ description: 'Stripe Price ID' })
  @IsString()
  priceId: string;

  @ApiProperty({ description: 'Quantity of the item', default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;
}

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'User ID for the checkout' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Stripe Price ID (for single item checkout)' })
  @IsString()
  @IsOptional()
  priceId?: string;

  @ApiPropertyOptional({
    description: 'Line items (for multi-item checkout)',
    type: [LineItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  @IsOptional()
  lineItems?: LineItemDto[];

  @ApiProperty({ enum: CheckoutMode, default: CheckoutMode.SUBSCRIPTION })
  @IsEnum(CheckoutMode)
  @IsOptional()
  mode?: CheckoutMode = CheckoutMode.SUBSCRIPTION;

  @ApiPropertyOptional({
    description: 'Success URL to redirect after checkout',
  })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'Cancel URL to redirect if checkout is canceled',
  })
  @IsString()
  @IsOptional()
  cancelUrl?: string;

  @ApiPropertyOptional({
    description: 'Collect shipping address',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  collectShippingAddress?: boolean = false;

  @ApiPropertyOptional({
    description: 'Trial period in days (for subscriptions)',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  trialPeriodDays?: number;

  @ApiPropertyOptional({ description: 'Customer consent to terms' })
  @IsBoolean()
  @IsOptional()
  consentToTerms?: boolean = false;

  @ApiPropertyOptional({
    description: 'Customer email (for checkout session)',
  })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional({
    description: 'Customer name (for checkout session)',
  })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({
    description: 'Customer phone number (for checkout session)',
  })
  @ApiProperty({ description: 'Stripe Customer ID', required: false })
  @IsOptional()
  @IsString()
  customerId?: string;
}
