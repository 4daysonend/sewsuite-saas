// Import removed as it's not currently being used

export interface NotificationPreferences {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  marketing?: boolean;
  orderUpdates?: boolean;
}

export interface UserPreferencesDefaults {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timeZone?: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  weekStart: string;
  distanceUnit: string;
  showHelp: boolean;
  desktopNotifications: boolean;
  calendarView: string;
}

export const DEFAULT_PREFERENCES: UserPreferencesDefaults = {
  theme: 'system',
  language: 'en-US',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  weekStart: 'sunday',
  distanceUnit: 'miles',
  showHelp: true,
  desktopNotifications: false,
  calendarView: 'week',
};
