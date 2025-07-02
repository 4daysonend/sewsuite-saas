/**
 * Enum for system alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Enum for system alert categories
 */
export enum AlertCategory {
  SYSTEM = 'system',
  PAYMENT = 'payment',
  SECURITY = 'security',
  USER = 'user',
  // other categories...
}
