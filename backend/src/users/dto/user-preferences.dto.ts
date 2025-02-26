import { Type } from 'class-transformer';
import { NotificationPreferences, UserPreferencesDefaults, DEFAULT_PREFERENCES } from './base-preferences.dto';

export class NotificationPreferencesDto implements NotificationPreferences {
  @ApiPropertyOptional({
    description: 'Whether to receive email notifications',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean = true;

  @ApiPropertyOptional({
    description: 'Whether to receive SMS notifications',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  sms?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether to receive push notifications',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  push?: boolean = true;

  @ApiPropertyOptional({
    description: 'Whether to receive marketing emails',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  marketing?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether to receive order updates',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  orderUpdates?: boolean = true;
}

export class UserPreferencesDto implements Partial<UserPreferencesDefaults> {
  @ApiPropertyOptional({
    enum: ['light', 'dark', 'system'],
    description: 'User interface theme preference',
    default: DEFAULT_PREFERENCES.theme
  })
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system' = DEFAULT_PREFERENCES.theme;

  @ApiPropertyOptional({
    description: 'Notification preferences',
    type: () => NotificationPreferencesDto
  })
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto = new NotificationPreferencesDto();

    @ApiPropertyOptional({
      description: 'User interface language preference',
      example: 'en-US'
    })
    @IsOptional()
    @IsLocale()
    language?: string = 'en-US';
  
    @ApiPropertyOptional({
      description: 'User timezone preference',
      example: 'America/New_York'
    })
    @IsOptional()
    @IsTimeZone()
    timeZone?: string;
  
    @ApiPropertyOptional({
      description: 'Preferred currency for payments and pricing',
      example: 'USD'
    })
    @IsOptional()
    @IsCurrency()
    currency?: string = 'USD';
  
    @ApiPropertyOptional({
      description: 'Date format preference',
      example: 'MM/DD/YYYY'
    })
    @IsOptional()
    @IsString()
    @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
    dateFormat?: string = 'MM/DD/YYYY';
  
    @ApiPropertyOptional({
      description: 'Time format preference',
      example: '12h'
    })
    @IsOptional()
    @IsString()
    @IsIn(['12h', '24h'])
    timeFormat?: string = '12h';
  
    @ApiPropertyOptional({
      description: 'First day of the week preference',
      example: 'sunday'
    })
    @IsOptional()
    @IsString()
    @IsIn(['sunday', 'monday'])
    weekStart?: string = 'sunday';
  
    @ApiPropertyOptional({
      description: 'Distance unit preference',
      example: 'miles'
    })
    @IsOptional()
    @IsString()
    @IsIn(['miles', 'kilometers'])
    distanceUnit?: string = 'miles';
  
    @ApiPropertyOptional({
      description: 'Whether to show inline help and tooltips',
      default: true
    })
    @IsOptional()
    @IsBoolean()
    showHelp?: boolean = true;
  
    @ApiPropertyOptional({
      description: 'Whether to enable desktop notifications',
      default: false
    })
    @IsOptional()
    @IsBoolean()
    desktopNotifications?: boolean = false;
  
    @ApiPropertyOptional({
      description: 'Default view for calendar',
      example: 'week'
    })
    @IsOptional()
    @IsString()
    @IsIn(['day', 'week', 'month'])
    calendarView?: string = 'week';
  
    constructor(partial: Partial<UserPreferencesDto> = {}) {
      Object.assign(this, {
        notifications: new NotificationPreferencesDto(),
        ...partial
      });
    }
  }
  
  // For updates, we'll allow partial updates of preferences
  export class UpdateUserPreferencesDto extends UserPreferencesDto {
    constructor(partial: Partial<UserPreferencesDto> = {}) {
      super();
      Object.assign(this, partial);
    }
  }