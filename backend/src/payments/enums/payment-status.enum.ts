// src/payments/enums/payment-status.enum.ts
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  CANCELED = 'canceled',
  REQUIRES_ACTION = 'requires_action',
  EXPIRED = 'expired',
}
