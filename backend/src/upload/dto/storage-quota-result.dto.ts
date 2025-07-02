import { ApiProperty } from '@nestjs/swagger';

export class StorageQuotaResultDto {
  @ApiProperty()
  used: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  percentage: number;

  @ApiProperty({ additionalProperties: { type: 'integer' } })
  quotaByCategory: Record<string, number>;
}
