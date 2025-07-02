// src/payments/utils/stripe-error.utils.ts
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

// Type guard for Stripe errors
export function isStripeError(
  error: unknown,
): error is Error & { type: string } {
  return error instanceof Error && 'type' in error;
}

// Handler for Stripe errors
export function handleStripeError(
  error: unknown,
  context = 'StripeService',
): never {
  const logger = new Logger(context);

  // Extract error message regardless of type
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log the error
  logger.error(`Stripe error: ${errorMessage}`, errorStack);

  // Handle Stripe-specific errors
  if (isStripeError(error)) {
    switch (error.type) {
      case 'StripeCardError':
        // Card errors - decline codes, insufficient funds, etc.
        throw new BadRequestException(`Payment failed: ${error.message}`);

      case 'StripeInvalidRequestError':
        // Invalid parameters, incorrect API usage
        throw new BadRequestException(`Invalid request: ${error.message}`);

      case 'StripeAPIError':
        // Stripe API errors
        throw new InternalServerErrorException('Payment service error');

      case 'StripeConnectionError':
        // Network issues connecting to Stripe
        throw new ServiceUnavailableException('Payment service unavailable');

      case 'StripeAuthenticationError':
        // API key issues
        logger.error('Stripe authentication error - check API keys');
        throw new InternalServerErrorException('Payment authentication error');

      case 'StripeRateLimitError':
        // Too many requests
        throw new ServiceUnavailableException('Too many payment requests');

      case 'StripeIdempotencyError':
        // Idempotency key reused incorrectly
        throw new BadRequestException('Duplicate payment request');

      default:
        // All other Stripe errors
        throw new InternalServerErrorException(
          `Payment processing error: ${error.message}`,
        );
    }
  }

  // For non-Stripe errors, throw a generic exception
  throw new InternalServerErrorException(
    `Payment service error: ${errorMessage}`,
  );
}
