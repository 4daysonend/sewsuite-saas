export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
  orderUpdates: boolean;
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
}

export interface WorkspacePreferences {
  defaultView: 'list' | 'grid' | 'calendar';
  showCompletedOrders: boolean;
  autoArchiveAfterDays: number;
  showNotifications: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'private' | 'contacts';
  showOnlineStatus: boolean;
  shareAnalytics: boolean;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  display: DisplayPreferences;
  workspace: WorkspacePreferences;
  privacy: PrivacyPreferences;
  features?: Record<string, boolean>;
}
