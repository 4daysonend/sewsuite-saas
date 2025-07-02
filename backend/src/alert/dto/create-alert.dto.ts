// src/alert/dto/create-alert.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertSeverity } from '../../common/enums/alert-severity.enum';

export class CreateAlertDto {
  @ApiProperty({ description: 'Alert message' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({
    enum: AlertSeverity,
    description: 'Alert severity level',
    example: AlertSeverity.INFO,
  })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiProperty({
    description: 'Additional alert details',
    required: false,
    example: 'Error occurred in payment processing service',
  })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiProperty({
    description: 'Category of the alert',
    required: false,
    example: 'system',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
