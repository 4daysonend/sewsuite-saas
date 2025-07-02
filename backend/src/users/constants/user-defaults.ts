// At the top of constants/user-defaults.ts
import { UserPreferences } from '../entities/user.entity'; // Adjust path as needed

/**
 * Default user preferences that are applied to new user accounts
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light', // Now this is one of the allowed values
  language: 'en',
  timeZone: 'UTC',
  currency: 'USD',
  notifications: {
    email: true,
    sms: false,
    push: true,
    marketing: false,
    orderUpdates: true,
  },
  features: {},
};

/**
 * Default storage quota values for different account types
 */
export const DEFAULT_STORAGE_QUOTAS = {
  free: 1024 * 1024 * 100, // 100 MB
  basic: 1024 * 1024 * 1024, // 1 GB
  pro: 1024 * 1024 * 1024 * 5, // 5 GB
  business: 1024 * 1024 * 1024 * 20, // 20 GB
};

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 10,
};
