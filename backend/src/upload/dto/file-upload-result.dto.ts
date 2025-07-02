import { ApiProperty, ApiResponse } from '@nestjs/swagger';
import { FileUploadResult } from '../types/upload.types';
import { File } from '../entities/file.entity';

@ApiResponse({
  status: 201,
  description: 'File uploaded successfully',
  type: FileUploadResultDto,
})
export class FileUploadResultDto implements FileUploadResult {
  @ApiProperty({ description: 'Upload success status' })
  success: boolean;

  @ApiProperty({
    description: 'Uploaded file entity',
    type: () => File,
    required: false,
  })
  entity?: File;

  @ApiProperty({
    description: 'Alternative property name for file entity',
    type: () => File,
    required: false,
  })
  file?: File;

  @ApiProperty({
    description: 'Download URL for the uploaded file',
    required: false,
  })
  url?: string;

  @ApiProperty({
    description: 'Optional message (especially for errors)',
    required: false,
  })
  message?: string;

  // Other properties as needed
}
