// /backend/src/orders/services/order-analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  FindOptionsWhere,
  SelectQueryBuilder,
} from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { differenceInDays } from 'date-fns';
import { PeriodType } from '../types/period.type';
import { RevenueTrendsDto } from '../dto/revenue-trends.dto';
import { CustomerInsightsDto } from '../dto/customer-insights.dto';

interface StatusCountResult {
  status: string;
  count: string;
}

interface RevenueByPeriodResult {
  period: string;
  revenue: string;
  orderCount: string;
}

interface CustomerCountResult {
  count: string;
}

interface RepeatCustomerResult {
  id: string;
  orderCount: string;
}

interface TopSellingProduct {
  productId: string;
  productName: string;
  totalSold: number;
}

interface TimeRange {
  startDate: string;
  endDate: string;
}

export class OrderAnalytics {
  // Required properties
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  revenueByPeriod: Array<{
    period: string;
    revenue: number;
    orderCount: number;
  }>;
  customerMetrics: {
    totalCustomers: number;
    repeatCustomers: number;
    averageOrdersPerCustomer: number;
  };
  performanceMetrics: {
    completionRate: number;
    averageCompletionTime: number;
    cancelationRate: number;
  };

  // Optional properties
  topSellingProducts?: TopSellingProduct[];
  timeRange?: TimeRange;
}

@Injectable()
export class OrderAnalyticsService {
  private readonly logger = new Logger('OrderAnalyticsService');

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getAnalyticsSummary(
    userId: string,
    role: string,
    startDate?: string,
    endDate?: string,
  ): Promise<OrderAnalytics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);
      const baseQuery = this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.client', 'client')
        .leftJoinAndSelect('order.tailor', 'tailor')
        .leftJoinAndSelect('order.payments', 'payments');

      // Apply role-based filtering
      if (role === UserRole.CLIENT) {
        baseQuery.where('client.id = :userId', { userId });
      } else if (role === UserRole.TAILOR) {
        baseQuery.where('tailor.id = :userId', { userId });
      }

      // Apply date filtering if provided
      if (dateFilter) {
        baseQuery.andWhere(dateFilter);
      }

      const orders = await baseQuery.getMany();

      // Calculate basic metrics
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + Number(order.price),
        0,
      );
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Get orders by status
      const ordersByStatus = await this.getOrdersByStatus(baseQuery);

      // Get revenue by period
      const revenueByPeriod = await this.getRevenueByPeriod(baseQuery);

      // Get customer metrics
      const customerMetrics = await this.getCustomerMetrics(baseQuery);

      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(orders);

      // Add new properties to the return object
      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        ordersByStatus,
        revenueByPeriod,
        customerMetrics,
        performanceMetrics,
        topSellingProducts: await this.getTopSellingProducts(baseQuery),
        timeRange: {
          startDate: startDate || new Date().toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
        },
      };
    } catch (error) {
      this.logger.error(
        `Error generating analytics summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private async getOrdersByStatus(
    baseQuery: SelectQueryBuilder<Order>,
  ): Promise<Record<string, number>> {
    const statusCounts = await baseQuery
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('order.status')
      .getRawMany();

    // Apply type assertion instead of generic parameter
    return (statusCounts as StatusCountResult[]).reduce(
      (acc, curr) => ({
        ...acc,
        [curr.status]: parseInt(curr.count),
      }),
      {} as Record<string, number>,
    );
  }

  private async getRevenueByPeriod(
    baseQuery: SelectQueryBuilder<Order>,
  ): Promise<
    Array<{
      period: string;
      revenue: number;
      orderCount: number;
    }>
  > {
    const results = await baseQuery
      .select([
        "DATE_TRUNC('month', order.createdAt)",
        'period',
        'SUM(order.price)',
        'revenue',
        'COUNT(*)',
        'orderCount',
      ])
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Apply type assertion instead of generic parameter
    return (results as RevenueByPeriodResult[]).map((item) => ({
      period: item.period,
      revenue: parseFloat(item.revenue),
      orderCount: parseInt(item.orderCount),
    }));
  }

  private buildDateFilter(
    startDate?: string,
    endDate?: string,
  ): FindOptionsWhere<Order> | null {
    if (startDate && endDate) {
      return {
        createdAt: Between(new Date(startDate), new Date(endDate)),
      };
    }
    if (startDate) {
      return {
        createdAt: MoreThanOrEqual(new Date(startDate)),
      };
    }
    if (endDate) {
      return {
        createdAt: LessThanOrEqual(new Date(endDate)),
      };
    }
    return null;
  }

  private async getCustomerMetrics(baseQuery: SelectQueryBuilder<Order>) {
    const totalCustomers = (await baseQuery
      .select('COUNT(DISTINCT client.id)', 'count')
      .getRawOne()) as CustomerCountResult;

    const repeatCustomers = (await baseQuery
      .select('client.id')
      .addSelect('COUNT(*)', 'orderCount')
      .groupBy('client.id')
      .having('COUNT(*) > 1')
      .getRawMany()) as RepeatCustomerResult[];

    const totalCustomersCount = Number(totalCustomers.count) || 0;

    const totalOrdersFromRepeatCustomers = repeatCustomers.reduce(
      (sum, customer) => sum + parseInt(customer.orderCount),
      0,
    );

    return {
      totalCustomers: totalCustomersCount,
      repeatCustomers: repeatCustomers.length,
      averageOrdersPerCustomer:
        totalCustomersCount > 0
          ? totalOrdersFromRepeatCustomers / totalCustomersCount
          : 0,
    };
  }

  private getPerformanceMetrics(orders: Order[]) {
    const completedOrders = orders.filter(
      (order) => order.status === OrderStatus.COMPLETED, // Use enum instead of string literal
    );
    const canceledOrders = orders.filter(
      (order) => order.status === OrderStatus.CANCELLED, // Use enum instead of string literal
    );

    const completionTimes = completedOrders.map((order) =>
      differenceInDays(new Date(order.updatedAt), new Date(order.createdAt)),
    );

    return {
      completionRate:
        orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0,
      averageCompletionTime:
        completionTimes.length > 0
          ? completionTimes.reduce((sum, time) => sum + time, 0) /
            completionTimes.length
          : 0,
      cancelationRate:
        orders.length > 0 ? (canceledOrders.length / orders.length) * 100 : 0,
    };
  }

  private async getTopSellingProducts(
    baseQuery: SelectQueryBuilder<Order>,
  ): Promise<TopSellingProduct[]> {
    // Implementation to fetch top selling products
    const results = await baseQuery
      .select([
        'product.id',
        'product.name',
        'SUM(order.quantity)',
        'totalSold',
      ])
      .innerJoin('order.products', 'product')
      .groupBy('product.id')
      .orderBy('totalSold', 'DESC')
      .getRawMany();

    return results.map((item) => ({
      productId: item.id,
      productName: item.name,
      totalSold: parseInt(item.totalSold),
    }));
  }

  /**
   * Get performance metrics for orders
   * @param userId The user's ID
   * @param role The user's role
   * @returns Performance metrics
   */
  async getPerformanceReport(userId: string, role: string) {
    this.logger.log(
      `Getting performance report for user ${userId} with role ${role}`,
    );

    try {
      // Create a query builder to fetch orders
      const queryBuilder = this.orderRepository.createQueryBuilder('order');

      // Apply role-based filtering
      if (role !== 'admin') {
        queryBuilder.where('order.tailorId = :userId', { userId });
      }

      // Calculate metrics
      const completedOrders = await queryBuilder
        .clone()
        .where('order.status = :status', { status: 'COMPLETED' })
        .getCount();

      const totalOrders = await queryBuilder.getCount();

      const completionRate =
        totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      // Calculate average completion time
      const completionTimeResult = await queryBuilder
        .select(
          'AVG(EXTRACT(EPOCH FROM (order.completedAt - order.createdAt)))',
          'avgCompletionTime',
        )
        .where('order.status = :status AND order.completedAt IS NOT NULL', {
          status: 'COMPLETED',
        })
        .getRawOne();

      const avgCompletionTime = completionTimeResult?.avgCompletionTime || 0;

      // Calculate cancellation rate
      const cancelledOrders = await queryBuilder
        .clone()
        .where('order.status = :status', { status: 'CANCELLED' })
        .getCount();

      const cancellationRate =
        totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

      return {
        completionRate,
        averageCompletionTime: avgCompletionTime, // in seconds
        cancellationRate,
        totalOrders,
        completedOrders,
        cancelledOrders,
      };
    } catch (error) {
      this.logger.error(
        `Error getting performance report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get revenue trends based on a specified time period
   * @param userId The user's ID
   * @param role The user's role
   * @param period The time period for aggregation (daily, weekly, monthly)
   * @param limit Number of periods to return
   * @returns Revenue trends data
   */
  async getRevenueTrends(
    userId: string,
    role: string,
    period: PeriodType,
    limit: number,
  ): Promise<RevenueTrendsDto> {
    this.logger.log(
      `Getting revenue trends for user ${userId} with role ${role}, period ${period}, limit ${limit}`,
    );

    try {
      // Create a query builder for orders
      let queryBuilder = this.orderRepository.createQueryBuilder('order');

      // Apply role-based filtering
      if (role !== 'admin') {
        queryBuilder = queryBuilder.where('order.tailorId = :userId', {
          userId,
        });
      }

      // Only include completed and paid orders
      queryBuilder = queryBuilder
        .andWhere('order.status = :status', { status: 'COMPLETED' })
        .andWhere('order.paymentStatus = :paymentStatus', {
          paymentStatus: 'PAID',
        });

      // Define the time grouping format based on period
      let timeFormat: string;

      switch (period) {
        case PeriodType.DAILY:
          timeFormat = 'YYYY-MM-DD';
          break;
        case PeriodType.WEEKLY:
          timeFormat = 'YYYY-WW'; // ISO week format
          break;
        case PeriodType.MONTHLY:
          timeFormat = 'YYYY-MM';
          break;
        default:
          timeFormat = 'YYYY-MM-DD';
      }

      // Get the end date (today)
      const endDate = new Date();

      // Calculate start date based on period and limit
      let startDate: Date;
      switch (period) {
        case PeriodType.DAILY:
          startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - limit);
          break;
        case PeriodType.WEEKLY:
          startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - limit * 7);
          break;
        case PeriodType.MONTHLY:
          startDate = new Date(endDate);
          startDate.setMonth(endDate.getMonth() - limit);
          break;
        default:
          startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - limit);
      }

      // Add date filtering
      queryBuilder = queryBuilder.andWhere(
        'order.completedAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );

      // Select the period and aggregate data
      const results = await queryBuilder
        .select(`TO_CHAR(order.completedAt, '${timeFormat}')`, 'period')
        .addSelect('SUM(order.totalAmount)', 'revenue')
        .addSelect('COUNT(order.id)', 'orderCount')
        .groupBy(`TO_CHAR(order.completedAt, '${timeFormat}')`)
        .orderBy(`TO_CHAR(order.completedAt, '${timeFormat}')`, 'ASC')
        .getRawMany();

      // Generate a complete series of periods, including ones with zero orders
      const trends = this.generateCompleteSeries(
        startDate,
        endDate,
        period,
        results,
      );

      return {
        trends,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error getting revenue trends: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Generate a complete series of periods, filling in gaps with zeros
   */
  private generateCompleteSeries(
    startDate: Date,
    endDate: Date,
    period: PeriodType,
    results: any[],
  ): { period: string; revenue: number; orderCount: number }[] {
    const series: { period: string; revenue: number; orderCount: number }[] =
      [];
    const resultMap = new Map(
      results.map((item) => [
        item.period,
        {
          revenue: parseFloat(item.revenue),
          orderCount: parseInt(item.orderCount),
        },
      ]),
    );

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      let periodKey: string;

      switch (period) {
        case PeriodType.DAILY:
          periodKey = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case PeriodType.WEEKLY:
          const year = currentDate.getFullYear();
          const weekNum = this.getWeekNumber(currentDate);
          periodKey = `${year}-W${weekNum.toString().padStart(2, '0')}`;
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case PeriodType.MONTHLY:
          periodKey = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          periodKey = currentDate.toISOString().split('T')[0];
          currentDate.setDate(currentDate.getDate() + 1);
      }

      const data = resultMap.get(periodKey) || { revenue: 0, orderCount: 0 };

      series.push({
        period: periodKey,
        revenue: data.revenue,
        orderCount: data.orderCount,
      });
    }

    return series;
  }

  /**
   * Get ISO week number for a date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Get customer insights analytics
   * @param userId The user's ID
   * @param role The user's role
   * @returns Customer insights data
   */
  async getCustomerInsights(
    userId: string,
    role: string,
  ): Promise<CustomerInsightsDto> {
    this.logger.log(
      `Getting customer insights for user ${userId} with role ${role}`,
    );

    try {
      // Create base query
      let queryBuilder = this.orderRepository
        .createQueryBuilder('order')
        .leftJoin('order.client', 'client');

      // Apply role-based filtering
      if (role !== 'admin') {
        queryBuilder = queryBuilder.where('order.tailorId = :userId', {
          userId,
        });
      }

      // Get total customer count
      const customerCount = await queryBuilder
        .select('COUNT(DISTINCT client.id)', 'count')
        .getRawOne()
        .then((result) => parseInt(result?.count || '0'));

      // Get new customers in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const newCustomerCount = await queryBuilder
        .clone()
        .select('COUNT(DISTINCT client.id)', 'count')
        .where('order.createdAt >= :date', { date: thirtyDaysAgo })
        .getRawOne()
        .then((result) => parseInt(result?.count || '0'));

      // Get repeat customer rate
      const repeatCustomerQuery = await queryBuilder
        .clone()
        .select('client.id', 'clientId')
        .addSelect('COUNT(order.id)', 'orderCount')
        .groupBy('client.id')
        .getRawMany();

      const repeatCustomerCount = repeatCustomerQuery.filter(
        (c) => parseInt(c.orderCount) > 1,
      ).length;
      const repeatRate =
        customerCount > 0 ? (repeatCustomerCount / customerCount) * 100 : 0;

      // Calculate average orders per customer
      const totalOrders = await queryBuilder.getCount();
      const avgOrdersPerCustomer =
        customerCount > 0 ? totalOrders / customerCount : 0;

      // Get top customers by order value
      const topCustomers = await queryBuilder
        .clone()
        .select('client.id', 'id')
        .addSelect('client.name', 'name')
        .addSelect('client.email', 'email')
        .addSelect('COUNT(order.id)', 'orderCount')
        .addSelect('SUM(order.totalAmount)', 'totalSpent')
        .groupBy('client.id')
        .addGroupBy('client.name')
        .addGroupBy('client.email')
        .orderBy('totalSpent', 'DESC')
        .limit(5)
        .getRawMany()
        .then((customers) =>
          customers.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            orderCount: parseInt(c.orderCount),
            totalSpent: parseFloat(c.totalSpent),
          })),
        );

      // Calculate customer lifetime value (CLV)
      const averageCustomerValue =
        customerCount > 0
          ? (await queryBuilder
              .clone()
              .select('SUM(order.totalAmount)', 'total')
              .where('order.status = :status', { status: 'COMPLETED' })
              .getRawOne()
              .then((result) => parseFloat(result?.total || '0'))) /
            customerCount
          : 0;

      return {
        customerCount,
        newCustomers: {
          count: newCustomerCount,
          period: '30 days',
        },
        repeatCustomerRate: repeatRate,
        averageOrdersPerCustomer: avgOrdersPerCustomer,
        averageCustomerValue: averageCustomerValue,
        topCustomers,
      } as CustomerInsightsDto;
    } catch (error) {
      this.logger.error(
        `Error getting customer insights: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
