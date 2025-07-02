// user-preferences.dto.ts
import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsValidTimezone } from '../../../common/validators/timezone.validator';

export class UserPreferencesDto {
  @ApiProperty({ description: 'User interface theme preference' })
  @IsString()
  @IsIn(['light', 'dark', 'system'])
  theme: 'light' | 'dark' | 'system';

  @ApiProperty({ description: 'User interface language' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'User preferred timezone' })
  @IsString()
  @IsOptional()
  @IsValidTimezone()
  timeZone?: string;

  @ApiProperty({ description: 'User preferred currency' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Email notification preferences' })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  // Add other preference properties as needed
}
