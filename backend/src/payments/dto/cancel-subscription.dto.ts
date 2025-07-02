import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * DTO for subscription cancellation data
 */
export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description:
      'Cancel immediately instead of at the end of the billing period',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  immediately?: boolean = false;

  @ApiPropertyOptional({
    description: 'Reason for cancellation',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Whether to notify the customer about cancellation',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean = true;
}
