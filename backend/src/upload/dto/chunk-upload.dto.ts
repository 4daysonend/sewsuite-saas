import { IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChunkUploadDto {
  @ApiProperty()
  @IsString()
  fileId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  chunkNumber: number;

  @ApiProperty()
  @IsNumber()
  totalChunks: number;
}