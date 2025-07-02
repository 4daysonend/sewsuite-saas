// /backend/src/orders/dto/create-order.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
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
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  quantity?: number;
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
  @IsOptional() // Make it optional since we'll calculate it server-side
  estimatedPrice?: number; // Rename from price to estimatedPrice for clarity

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dueDate?: Date;
}
