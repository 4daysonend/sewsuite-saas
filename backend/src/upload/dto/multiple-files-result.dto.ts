import { ApiProperty } from '@nestjs/swagger';
import { FileUploadResultDto } from './file-upload-result.dto';

export class MultipleFilesResultDto {
  @ApiProperty({ type: [FileUploadResultDto] })
  files: FileUploadResultDto[];

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failureCount: number;
}
