import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '../entities/file.entity';

export class FileStatusResultDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: FileStatus })
  status: FileStatus;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  error?: string;
}
