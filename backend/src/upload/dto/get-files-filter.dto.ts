// src/upload/dto/get-files-filter.dto.ts
import { IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory } from '../entities/file.entity';

export class GetFilesFilterDto {
  @ApiPropertyOptional({ enum: FileCategory })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
