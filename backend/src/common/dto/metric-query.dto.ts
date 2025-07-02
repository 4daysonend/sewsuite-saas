import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MetricQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  component?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ enum: ['1h', '24h', '7d', '30d'] })
  @IsOptional()
  @IsEnum(['1h', '24h', '7d', '30d'])
  period?: string;
}
