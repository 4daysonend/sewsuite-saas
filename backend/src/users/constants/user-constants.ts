import { UserPreferences } from '../interfaces/user-preferences.interface';

export const DEFAULT_STORAGE_QUOTA = 1073741824; // 1GB in bytes

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PROFESSIONAL: 'professional',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
} as const;

export const STORAGE_QUOTAS = {
  [SUBSCRIPTION_TIERS.FREE]: DEFAULT_STORAGE_QUOTA,
  [SUBSCRIPTION_TIERS.PROFESSIONAL]: DEFAULT_STORAGE_QUOTA * 10, // 10GB
  [SUBSCRIPTION_TIERS.BUSINESS]: DEFAULT_STORAGE_QUOTA * 100, // 100GB
  [SUBSCRIPTION_TIERS.ENTERPRISE]: DEFAULT_STORAGE_QUOTA * 1000, // 1TB
} as const;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    email: true,
    sms: false,
    push: true,
    marketing: false,
    orderUpdates: true,
  },
  display: {
    theme: 'system',
    language: 'en-US',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    currency: 'USD',
  },
  workspace: {
    defaultView: 'list',
    showCompletedOrders: true,
    autoArchiveAfterDays: 30,
    showNotifications: true,
  },
  privacy: {
    profileVisibility: 'public',
    showOnlineStatus: true,
    shareAnalytics: true,
  },
  features: {},
};

export const PASSWORD_VALIDATION = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  SPECIAL_CHARS: '!@#$%^&*(),.?":{}|<>',
};

export const EMAIL_VERIFICATION = {
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  MAX_ATTEMPTS: 3,
  COOLDOWN: 5 * 60 * 1000, // 5 minutes
};

export const SESSION_CONFIG = {
  MAX_SESSIONS: 5,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const RATE_LIMITS = {
  LOGIN_ATTEMPTS: {
    WINDOW: 15 * 60 * 1000, // 15 minutes
    MAX_ATTEMPTS: 5,
  },
  PASSWORD_RESET: {
    WINDOW: 24 * 60 * 60 * 1000, // 24 hours
    MAX_ATTEMPTS: 3,
  },
};
