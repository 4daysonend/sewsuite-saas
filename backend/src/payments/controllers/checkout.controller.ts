import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  ParseUUIDPipe,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Req,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaymentsService } from '../services/payments.service';
import { CreateCheckoutSessionDto } from '../dto/create-checkout-session.dto';
import { User } from '../../users/decorators/user.decorator';
import { AuditService } from '../../common/services/audit.service';
import { Subscription } from '../entities/subscription.entity';
import { VaultService } from '../../config/vault.service';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
    private readonly vaultService: VaultService, // Add this line to inject VaultService
  ) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create a checkout session' })
  @ApiResponse({ status: 200, description: 'Returns checkout session URL' })
  async createCheckoutSession(
    @Body() checkoutDto: CreateCheckoutSessionDto,
    @User() user: any,
    @Req() request: Request,
  ) {
    try {
      // Get or create the Stripe customer ID for this user
      const customerId = await this.paymentsService.getStripeCustomerId(
        user.id,
        user.email,
      );

      const session = await this.paymentsService.createCheckoutSession(
        {
          ...checkoutDto,
          userId: user.id,
          customerEmail: user.email,
          customerId, // Add the customer ID here
        },
        {
          successUrl:
            checkoutDto.successUrl ||
            `${process.env.FRONTEND_URL}/payment/success`,
          cancelUrl:
            checkoutDto.cancelUrl ||
            `${process.env.FRONTEND_URL}/payment/cancel`,
          metadata: {
            source: 'web-checkout',
            userId: user.id,
          },
        },
      );

      // Log the checkout session creation to audit log
      await this.auditService.logAction({
        userId: user.id,
        action: 'payment.checkout.created',
        details: {
          checkoutSessionId: session.id,
          priceId: checkoutDto.priceId,
          mode: checkoutDto.mode,
          timestamp: new Date().toISOString(),
          source: 'checkout-controller',
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error creating checkout session: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }
  }

  @Get('customer-portal')
  @ApiOperation({ summary: 'Create a Stripe customer portal session' })
  @ApiResponse({ status: 200, description: 'Returns customer portal URL' })
  async createCustomerPortalSession(@User() user: any) {
    try {
      // Get the Stripe customer ID from the user
      const stripeCustomerId = await this.paymentsService.getStripeCustomerId(
        user.id,
      );

      if (!stripeCustomerId) {
        throw new BadRequestException(
          'User does not have a Stripe customer ID',
        );
      }

      const session =
        await this.paymentsService.createBillingPortalSession(stripeCustomerId);

      // Log to audit trail
      await this.auditService.logAction({
        userId: user.id,
        action: 'payment.customer-portal.accessed',
        details: {
          sessionId: session.id,
        },
      });

      return {
        url: session.url,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error creating customer portal session: ${err.message}`,
        err.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to create customer portal session',
      );
    }
  }

  @Get('subscription/:subscriptionId')
  @ApiOperation({ summary: 'Get subscription details' })
  @ApiResponse({ status: 200, description: 'Returns subscription details' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to this subscription',
  })
  async getSubscription(
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @User() user: any,
  ): Promise<Subscription> {
    try {
      const subscription = await this.paymentsService.getSubscription(
        subscriptionId,
        user.id,
      );

      // Log access to audit trail
      await this.auditService.logAction({
        userId: user.id,
        action: 'user.subscription.viewed',
        details: { subscriptionId },
      });

      return subscription;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Error retrieving subscription: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Re-throw NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error retrieving subscription details',
      );
    }
  }

  @Get('config')
  @ApiOperation({ summary: 'Get Stripe publishable key' })
  getStripeConfig() {
    return {
      publishableKey: this.vaultService.getSecret('STRIPE_PUBLISHABLE_KEY'),
    };
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly vaultService: VaultService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get Stripe publishable key' })
  getStripeConfig() {
    return {
      publishableKey: this.vaultService.getSecret('STRIPE_PUBLISHABLE_KEY'),
    };
  }
}
