import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  DefaultValuePipe,
  NotFoundException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PaymentsService } from '../services/payments.service';
import { PaymentAnalyticsService } from '../services/payment-analytics.service';
import { User } from '../../users/decorators';
import { AuditService } from '../../common/services/audit.service';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { TransactionsResponseDto } from '../dto/transactions-response.dto';
import { TransactionsQueryDto } from '../dto/transactions-query.dto';
import { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';
import { Logger } from '@nestjs/common';
import { MRRDataDto } from '../dto/mrr-data.dto';
import { ChurnDataDto } from '../dto/churn-data.dto';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Payment } from '../entities/payment.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { Subscription } from '../entities/subscription.entity';
import { User as UserEntity } from '../../users/entities/user.entity';
import { Response } from 'express';

@ApiTags('admin-payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminPaymentController {
  private readonly logger = new Logger(AdminPaymentController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentAnalyticsService: PaymentAnalyticsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('transactions')
  @ApiOperation({
    summary: 'Get all transactions with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of transactions',
    type: TransactionsResponseDto,
  })
  async getTransactions(
    @Query() query: TransactionsQueryDto,
    @User() admin: UserEntity,
  ): Promise<TransactionsResponseDto> {
    try {
      // Log admin access to payment data
      await this.auditService.logAction({
        userId: admin.id,
        action: 'admin.payments.view-transactions',
        details: query,
      });

      // Use type assertion if necessary to fix the enum type mismatch
      const statusFilter = query.status
        ? (query.status as unknown as PaymentStatus)
        : undefined;

      // Get transactions with pagination
      const { data, total } = await this.paymentsService.getAllPayments(
        query.page || 1,
        query.limit || 20,
        {
          status: statusFilter,
          userId: query.userId,
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
          minAmount: query.minAmount,
          maxAmount: query.maxAmount,
        },
      );

      // This line explicitly uses the Payment type
      const transactions: Payment[] = data;

      // Calculate total pages
      const pages = Math.ceil(total / (query.limit || 20));

      return {
        data: transactions,
        total,
        page: query.page || 1,
        limit: query.limit || 20,
        pages,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Error retrieving transactions: ${errorMessage}`);
      throw new InternalServerErrorException('Error retrieving transactions');
    }
  }

  @Get('transaction/:id')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiResponse({ status: 200, description: 'Returns transaction details' })
  async getTransactionDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @User() admin: any,
  ) {
    const payment = await this.paymentsService.getPaymentById(id);

    // Log admin access to payment details
    await this.auditService.logAction({
      userId: admin.id,
      action: 'admin.payments.view-transaction-details',
      details: { paymentId: id },
    });

    return payment;
  }

  @Post('refund/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiResponse({ status: 200, description: 'Payment refunded' })
  async refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @User() admin: any,
    @Body() refundDto: RefundPaymentDto,
  ) {
    // Process the refund
    const result = await this.paymentsService.createRefund(
      id,
      admin.id,
      refundDto,
    );

    // Log the admin action
    await this.auditService.logAction({
      userId: admin.id,
      action: 'admin.payments.refund',
      details: {
        paymentId: id,
        amount: refundDto.amount || result.payment.amount,
        reason: refundDto.reason || 'Not specified',
        refundId: result.refundId,
      },
    });

    return result;
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions' })
  @ApiResponse({ status: 200, description: 'Returns all subscriptions' })
  async getAllSubscriptions(
    @User() admin: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: SubscriptionStatus,
    @Query('userId') userId?: string,
  ): Promise<{ data: Subscription[]; total: number }> {
    try {
      // Log admin access to subscription data
      await this.auditService.logAction({
        userId: admin.id,
        action: 'admin.subscriptions.view-all',
        details: { page, limit, status, userId },
      });

      return this.paymentsService.getAllSubscriptions(page, limit, {
        status: status as unknown as any,
        userId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error retrieving subscriptions: ${errorMessage}`);
      throw new InternalServerErrorException('Error retrieving subscriptions');
    }
  }

  @Get('subscription/:id')
  @ApiOperation({ summary: 'Get subscription details' })
  @ApiResponse({ status: 200, description: 'Returns subscription details' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @User() admin: any,
  ): Promise<Subscription> {
    try {
      // Get the subscription
      const subscription = await this.paymentsService.getSubscriptionById(id);

      // Log admin access
      await this.auditService.logAction({
        userId: admin.id,
        action: 'admin.subscriptions.view-details',
        details: { subscriptionId: id },
      });

      return subscription;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error retrieving subscription: ${errorMessage}`);

      // Re-throw NotFoundException
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error retrieving subscription details',
      );
    }
  }

  @Post('subscription/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @User() admin: any,
    @Body() cancelDto: CancelSubscriptionDto,
  ): Promise<Subscription> {
    try {
      return await this.paymentsService.cancelSubscription(id, admin.id, {
        immediately: cancelDto.immediately,
        reason: cancelDto.reason,
        sendEmail: cancelDto.notifyCustomer,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error canceling subscription: ${errorMessage}`);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Error canceling subscription');
    }
  }

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get payment analytics overview' })
  @ApiResponse({ status: 200, description: 'Returns payment analytics' })
  async getAnalyticsOverview(
    @Query('days', new ParseIntPipe({ optional: true })) days = 30,
    @User() admin: any,
  ) {
    if (days <= 0 || days > 365) {
      throw new BadRequestException('Days must be between 1 and 365');
    }

    // Log admin access
    await this.auditService.logAction({
      userId: admin.id,
      action: 'admin.payments.view-analytics',
      details: { days },
    });

    return this.paymentAnalyticsService.getPaymentActivitySummary(days);
  }

  @Get('analytics/mrr')
  @ApiOperation({ summary: 'Get MRR data' })
  @ApiResponse({
    status: 200,
    description: 'Returns MRR data',
    type: [MRRDataDto], // Note the array notation for an array of DTOs
  })
  async getMRRData(
    @User() admin: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<MRRDataDto[]> {
    // Log admin access
    await this.auditService.logAction({
      userId: admin.id,
      action: 'admin.payments.view-mrr-data',
      details: { startDate, endDate },
    });

    // Convert string dates to Date objects if provided
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.paymentAnalyticsService.getMRRData(start, end);
  }

  @Get('analytics/churn')
  @ApiOperation({ summary: 'Get churn rate data' })
  @ApiResponse({
    status: 200,
    description: 'Returns churn rate data',
    type: [ChurnDataDto],
  })
  async getChurnData(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly',
    @User() admin: any,
  ): Promise<ChurnDataDto[]> {
    // Log admin access
    await this.auditService.logAction({
      userId: admin.id,
      action: 'admin.payments.view-churn',
      details: { period },
    });

    // Call the service method
    const churnData =
      await this.paymentAnalyticsService.calculateChurnRate(period);

    // Convert to DTOs if needed
    return churnData.map((data) => ({
      period: data.period,
      date: data.date,
      totalCustomers: data.totalCustomers,
      churnedCustomers: data.churnedCustomers,
      churnRate: data.churnRate,
    }));
  }

  @Get('analytics/failures')
  @ApiOperation({ summary: 'Get payment failure analytics' })
  @ApiResponse({ status: 200, description: 'Returns payment failure data' })
  async getFailureAnalytics(
    @Query('days', new ParseIntPipe({ optional: true })) days = 30,
    @User() admin: any,
  ) {
    // Log admin access
    await this.auditService.logAction({
      userId: admin.id,
      action: 'admin.payments.view-failures',
      details: { days },
    });

    return this.paymentAnalyticsService.getPaymentFailuresByUser(days);
  }

  @Get('customer-portal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Access the customer billing portal' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Stripe customer portal',
  })
  async customerPortal(@User() user: UserEntity, @Res() res: Response) {
    try {
      // Get the user's Stripe customer ID
      const stripeCustomerId = user.stripeCustomerId;

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

      // Redirect to the portal URL
      return res.redirect(session.url);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Error accessing customer portal: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to access the billing portal',
      );
    }
  }
}
