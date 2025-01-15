import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class FabricDetailsDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  color: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}

class ServiceDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  tailorId: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ type: () => FabricDetailsDto })
  @ValidateNested()
  @Type(() => FabricDetailsDto)
  fabricDetails: FabricDetailsDto;

  @ApiProperty({ type: [ServiceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDto)
  services: ServiceDto[];

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dueDate?: Date;
}
