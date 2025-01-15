import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OrderAnalyticsService } from '../services/order-analytics.service';
import { OrderAnalytics } from '../interfaces/analytics.interface';

@ApiTags('order-analytics')
@Controller('order-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrderAnalyticsController {
  constructor(private readonly analyticsService: OrderAnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get order analytics summary' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({
    status: 200,
    description: 'Returns analytics summary',
    type: OrderAnalytics,
  })
  async getAnalyticsSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req,
  ): Promise<OrderAnalytics> {
    return this.analyticsService.getAnalyticsSummary(
      req.user.id,
      req.user.role,
      startDate,
      endDate,
    );
  }

  @Get('performance')
  @Roles('admin', 'tailor')
  @ApiOperation({ summary: 'Get performance report' })
  @ApiResponse({
    status: 200,
    description: 'Returns performance metrics',
  })
  async getPerformanceReport(@Req() req) {
    return this.analyticsService.getPerformanceReport(
      req.user.id,
      req.user.role,
    );
  }

  @Get('revenue-trends')
  @Roles('admin', 'tailor')
  @ApiOperation({ summary: 'Get revenue trends' })
  @ApiQuery({ name: 'period', enum: ['daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'limit', required: false })
  async getRevenueTrends(
    @Query('period') period: string,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Req() req,
  ) {
    return this.analyticsService.getRevenueTrends(
      req.user.id,
      req.user.role,
      period,
      limit,
    );
  }

  @Get('customer-insights')
  @Roles('admin', 'tailor')
  @ApiOperation({ summary: 'Get customer insights' })
  async getCustomerInsights(@Req() req) {
    return this.analyticsService.getCustomerInsights(
      req.user.id,
      req.user.role,
    );
  }
}
