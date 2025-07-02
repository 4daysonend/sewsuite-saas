// src/payments/enums/subscription-status.enum.ts
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  EXPIRED = 'incomplete_expired',
  PAST_DUE = 'past_due',
  PAUSED = 'paused', // Another potential Stripe status
  TRIAL = 'trialing',
  UNPAID = 'unpaid',
  UNKNOWN = 'unknown',
  PENDING_CANCELLATION = 'PENDING_CANCELLATION',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED', // Fallback for unexpected values
}
