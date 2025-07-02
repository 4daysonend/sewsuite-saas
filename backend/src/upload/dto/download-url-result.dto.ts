import { ApiProperty } from '@nestjs/swagger';

export class DownloadUrlResultDto {
  @ApiProperty({ format: 'uri' })
  url: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
