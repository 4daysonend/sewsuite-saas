import { IsBoolean, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// NotificationPreferences section
export class NotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Receive email notifications',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean = true;

  @ApiPropertyOptional({
    description: 'Receive SMS notifications',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sms?: boolean = false;

  @ApiPropertyOptional({
    description: 'Receive push notifications',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  push?: boolean = true;

  @ApiPropertyOptional({
    description: 'Receive marketing emails',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  marketing?: boolean = false;
}

// Define a features interface for better type safety
export interface FeaturePreferences {
  [key: string]: boolean;
}

// Main UserPreferencesDto
export class UserPreferencesDto {
  @ApiPropertyOptional({
    description: 'User notification preferences',
    type: NotificationPreferencesDto,
  })
  @IsOptional()
  @IsObject()
  notifications?: NotificationPreferencesDto;

  @ApiPropertyOptional({
    description: 'User interface preferences',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  ui?: {
    theme?: string;
    language?: string;
    [key: string]: any;
  };

  @ApiPropertyOptional({
    description: 'User timezone',
    example: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'User enabled/disabled features',
    type: Object,
    example: {
      advancedReporting: true,
      betaFeatures: false,
    },
  })
  @IsOptional()
  @IsObject()
  features?: FeaturePreferences;
}
