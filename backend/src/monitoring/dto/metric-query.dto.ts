import { IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MetricQueryDto {
  @ApiProperty({
    required: false,
    description: 'Time period (1h, 24h, 7d, 30d)',
    example: '24h',
  })
  @IsOptional()
  @IsString()
  timeframe?: string;

  @ApiProperty({ required: false, description: 'Start time for custom range' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startTime?: Date;

  @ApiProperty({ required: false, description: 'End time for custom range' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;

  @ApiProperty({ required: false, description: 'Component or service name' })
  @IsOptional()
  @IsString()
  component?: string;

  @ApiProperty({ required: false, description: 'File type' })
  @IsOptional()
  @IsString()
  fileType?: string;
}
