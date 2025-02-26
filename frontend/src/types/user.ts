// src/types/user.ts

export enum UserRole {
    ADMIN = 'admin',
    TAILOR = 'tailor',
    CLIENT = 'client',
  }
  
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
    notifications?: NotificationPreferences;
    display?: DisplayPreferences;
    workspace?: WorkspacePreferences;
    privacy?: PrivacyPreferences;
    features?: Record<string, boolean>;
  }
  
  export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    phoneNumber?: string;
    address?: string;
    emailVerified: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    preferences: UserPreferences;
    lastLoginAt?: string;
    fullName?: string;
    displayRole?: string;
    isSubscribed?: boolean;
  }
  
  export interface StorageQuota {
    id: string;
    userId: string;
    totalSpace: number;
    usedSpace: number;
    quotaByCategory?: Record<string, number>;
    lastQuotaUpdate?: string;
    nextResetDate?: string;
    canExceedQuota: boolean;
    maxOverage: number;
  }