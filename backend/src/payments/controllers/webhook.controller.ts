import {
  Controller,
  Post,
  RawBodyRequest,
  Req,
  Headers,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  Logger,
  Body,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentsService } from '../services/payments.service';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('webhooks')
@Controller('payments')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Handle Stripe webhook events
   * This endpoint is excluded from API documentation for security reasons
   */
  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle() // Skip rate limiting for Stripe webhooks
  @ApiExcludeEndpoint() // Don't show in Swagger docs for security
  @ApiOperation({ summary: 'Process Stripe webhook events' })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Signature verifying the event came from Stripe',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook payload or signature',
  })
  @ApiResponse({ status: 500, description: 'Server error processing webhook' })
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Body() body: Buffer,
  ): Promise<{ received: boolean }> {
    this.logger.log('Received webhook from Stripe');

    try {
      if (!signature) {
        this.logger.warn('Missing stripe-signature header');
        throw new BadRequestException('Missing stripe-signature header');
      }

      // Get raw body - important to use the raw buffer for signature validation
      const rawBody = request.rawBody || body;

      if (!rawBody) {
        this.logger.warn('Missing request body');
        throw new BadRequestException('Missing request body');
      }

      // Validate webhook signature and parse event
      const event = await this.paymentsService.validateWebhook(
        rawBody,
        signature,
      );

      // Process the webhook event asynchronously
      // We don't await this to return a quick response to Stripe
      this.processWebhookAsync(event).catch((error) => {
        this.logger.error(
          `Error processing webhook asynchronously: ${error.message}`,
          error.stack,
        );
      });

      return { received: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Webhook error: ${errorMessage}`, errorStack);

      // Preserve BadRequestException but wrap others in InternalServerError
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'An error occurred processing the webhook',
      );
    }
  }

  /**
   * Process webhook events asynchronously to return a quick response to Stripe
   */
  private async processWebhookAsync(event: any): Promise<void> {
    try {
      this.logger.log(`Processing webhook event type: ${event.type}`);
      await this.paymentsService.handleWebhookEvent(event);
      this.logger.log(`Successfully processed webhook event: ${event.id}`);
    } catch (error) {
      // Log error but don't throw since this is running asynchronously
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to process webhook event ${event.id}: ${errorMessage}`,
        errorStack,
      );
    }
  }
}
