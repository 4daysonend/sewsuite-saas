import { ApiProperty } from '@nestjs/swagger';

export class ChunkUploadResultDto {
  @ApiProperty()
  received: boolean;

  @ApiProperty()
  chunksReceived: number;

  @ApiProperty()
  totalChunks: number;

  @ApiProperty({ required: false })
  complete?: boolean;
}
