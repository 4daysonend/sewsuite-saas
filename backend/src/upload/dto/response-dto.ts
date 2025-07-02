import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { File, FileStatus } from '../entities/file.entity';

export class FileUploadResultDto {
  @ApiProperty({ type: () => File })
  file: File;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional({ type: Date })
  expiresAt?: Date;
}

// Create similar classes for other response types...

export class FileStatusResultDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: FileStatus })
  status: string;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  error?: string;
}

// Then in your controller, use these DTOs for the Swagger documentation
