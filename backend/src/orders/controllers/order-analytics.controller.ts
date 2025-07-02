import { Controller, Get, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { OrderAnalyticsService } from './order-analytics.service';
import { OrderAnalytics as ImportedOrderAnalytics } from '../../orders/interfaces/order-analytics.interface';

export interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  topSellingProducts: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  timeRange: {
    start: Date;
    end: Date;
  };
  // Either make these optional or populate them in the service
  completedOrders?: number;
  pendingOrders?: number;
  canceledOrders?: number;
  revenueByPeriod?: Array<{
    period: string;
    revenue: number;
    orderCount: number;
  }>;
}

@ApiTags('analytics')
@Controller('analytics/orders')
export class OrderAnalyticsController {
  constructor(private readonly analyticsService: OrderAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get order analytics summary' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAnalytics(
    @Req() req: RequestWithUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Partial<ImportedOrderAnalytics>> {
    return this.analyticsService.getAnalyticsSummary(
      req.user.id,
      req.user.role,
      startDate,
      endDate,
    );
  }
}
