// src/payments/types/stripe.types.ts
export interface StripeError extends Error {
  type:
    | 'StripeCardError'
    | 'StripeInvalidRequestError'
    | 'StripeAPIError'
    | 'StripeConnectionError'
    | 'StripeAuthenticationError'
    | 'StripeRateLimitError'
    | 'StripeIdempotencyError'
    | string; // For other potential error types
  code?: string;
  param?: string;
  detail?: string;
  statusCode?: number;
  requestId?: string;
}

// Then update your type guard
export function isStripeError(error: unknown): error is StripeError {
  return error instanceof Error && 'type' in error;
}
