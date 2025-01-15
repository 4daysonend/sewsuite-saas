import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderRepository } from '../orders.repository';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { OrderAnalytics } from '../interfaces/analytics.interface';
import { UserRole } from '../../users/entities/user.entity';
import { OrderStatus } from '../entities/order.entity';
import { differenceInDays } from 'date-fns';

@Injectable()
export class OrderAnalyticsService {
  private readonly logger = new Logger(OrderAnalyticsService.name);

  constructor(
    @InjectRepository(OrderRepository)
    private readonly orderRepository: OrderRepository,
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

      // Get all orders for analysis
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

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        ordersByStatus,
        revenueByPeriod,
        customerMetrics,
        performanceMetrics,
      };
    } catch (error) {
      this.logger.error(`Error generating analytics summary: ${error.message}`);
      throw error;
    }
  }

  private async getOrdersByStatus(
    baseQuery: any,
  ): Promise<Record<string, number>> {
    const statusCounts = await baseQuery
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('order.status')
      .getRawMany();

    return statusCounts.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.status]: parseInt(curr.count),
      }),
      {},
    );
  }

  private async getRevenueByPeriod(baseQuery: any): Promise<any[]> {
    return baseQuery
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
  }

  private async getCustomerMetrics(baseQuery: any) {
    // Get total unique customers
    const totalCustomersQuery = baseQuery
      .select('COUNT(DISTINCT client.id)', 'count')
      .getRawOne();

    // Get repeat customers (clients with more than one order)
    const repeatCustomersQuery = baseQuery
      .select('client.id')
      .addSelect('COUNT(*)', 'orderCount')
      .groupBy('client.id')
      .having('COUNT(*) > 1')
      .getRawMany();

    const [totalCustomers, repeatCustomers] = await Promise.all([
      totalCustomersQuery,
      repeatCustomersQuery,
    ]);

    return {
      totalCustomers: parseInt(totalCustomers.count),
      repeatCustomers: repeatCustomers.length,
      averageOrdersPerCustomer:
        totalCustomers.count > 0
          ? repeatCustomers.reduce(
              (sum, customer) => sum + parseInt(customer.orderCount),
              0,
            ) / totalCustomers.count
          : 0,
    };
  }

  private async getPerformanceMetrics(orders: any[]): Promise<any> {
    const completedOrders = orders.filter(
      (order) => order.status === OrderStatus.COMPLETED,
    );
    const canceledOrders = orders.filter(
      (order) => order.status === OrderStatus.CANCELLED,
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

  private buildDateFilter(startDate?: string, endDate?: string) {
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

  async getPerformanceReport(userId: string, role: string): Promise<any> {
    try {
      const baseQuery = this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.client', 'client')
        .leftJoinAndSelect('order.tailor', 'tailor');

      if (role === UserRole.TAILOR) {
        baseQuery.where('tailor.id = :userId', { userId });
      }

      // Calculate key performance indicators
      const [completionStats, revenueStats, customerSatisfaction] =
        await Promise.all([
          this.calculateCompletionStats(baseQuery),
          this.calculateRevenueStats(baseQuery),
          this.calculateCustomerSatisfaction(baseQuery),
        ]);

      return {
        completionStats,
        revenueStats,
        customerSatisfaction,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error generating performance report: ${error.message}`,
      );
      throw error;
    }
  }

  private async calculateCompletionStats(baseQuery: any) {
    return baseQuery
      .select([
        'AVG(CASE WHEN order.status = :completed THEN 1 ELSE 0 END)',
        'completionRate',
        'AVG(EXTRACT(EPOCH FROM (order.updatedAt - order.createdAt))/86400)',
        'avgCompletionDays',
      ])
      .setParameter('completed', OrderStatus.COMPLETED)
      .getRawOne();
  }

  private async calculateRevenueStats(baseQuery: any) {
    return baseQuery
      .select([
        'SUM(order.price)',
        'totalRevenue',
        'AVG(order.price)',
        'avgOrderValue',
        'COUNT(*)',
        'totalOrders',
      ])
      .getRawOne();
  }

  private async calculateCustomerSatisfaction(baseQuery: any) {
    // This could be expanded with actual customer feedback/rating data
    return baseQuery
      .select([
        'COUNT(CASE WHEN order.status = :cancelled THEN 1 END)',
        'cancelations',
        'COUNT(*)',
        'totalOrders',
      ])
      .setParameter('cancelled', OrderStatus.CANCELLED)
      .getRawOne();
  }
}
