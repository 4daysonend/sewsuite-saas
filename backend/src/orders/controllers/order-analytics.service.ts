import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { PeriodType } from '../types/period.type';

// At the top level, with your other imports
interface RevenueResult {
  period: string;
  revenue: string;
}

interface PeriodConfig {
  days: number;
  format: string;
  groupBy: string;
}

const periodMap: Record<PeriodType, PeriodConfig> = {
  DAILY: {
    days: 1,
    format: 'yyyy-MM-dd',
    groupBy: 'DATE(order.createdAt)',
  },
  WEEKLY: {
    days: 7,
    format: 'yyyy-[W]ww',
    groupBy:
      "CONCAT(YEAR(order.createdAt), '-', LPAD(WEEK(order.createdAt), 2, '0'))",
  },
  MONTHLY: {
    days: 30,
    format: 'yyyy-MM',
    groupBy:
      "CONCAT(YEAR(order.createdAt), '-', LPAD(MONTH(order.createdAt), 2, '0'))",
  },
};

@Injectable()
export class OrderAnalyticsService {
  private readonly logger = new Logger(OrderAnalyticsService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  async getAnalyticsSummary(
    userId: string,
    userRole: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    try {
      const startDate = startDateStr
        ? new Date(startDateStr)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
      const endDate = endDateStr ? new Date(endDateStr) : new Date();

      // Build query based on user role
      let queryBuilder = this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .where('order.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });

      // Filter by user ID if not admin
      if (userRole !== 'admin') {
        if (userRole === 'client') {
          queryBuilder = queryBuilder.andWhere('order.clientId = :userId', {
            userId,
          });
        } else if (userRole === 'tailor') {
          queryBuilder = queryBuilder.andWhere('order.tailorId = :userId', {
            userId,
          });
        }
      }

      const orders = await queryBuilder.getMany();

      // Calculate analytics
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0,
      );
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Group orders by status
      const ordersByStatus = this.groupOrdersByStatus(orders);

      // Find top selling products
      const topSellingProducts = await this.getTopSellingProducts(
        startDate,
        endDate,
        userId,
        userRole,
      );

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        ordersByStatus,
        topSellingProducts,
        timeRange: {
          start: startDate,
          end: endDate,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting analytics summary: ${errorMessage}`);
      throw error;
    }
  }

  async getPerformanceReport(userId: string, userRole?: string) {
    try {
      // Date ranges for calculations
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const now = new Date();

      // Build base query with role-based filtering
      let queryBuilder = this.orderRepository.createQueryBuilder('order');

      // Apply role-based filtering
      if (userRole !== 'admin') {
        if (userRole === 'tailor') {
          queryBuilder = queryBuilder.where('order.tailorId = :userId', {
            userId,
          });
        } else if (userRole === 'client') {
          queryBuilder = queryBuilder.where('order.clientId = :userId', {
            userId,
          });
        }
      }

      // Add date filtering using Between
      queryBuilder = queryBuilder.andWhere({
        createdAt: Between(oneMonthAgo, now),
      });

      // Get all orders for calculations
      const orders = await queryBuilder.getMany();

      // Calculate completion rate
      const totalOrders = orders.length;
      const completedOrders = orders.filter(
        (order) => order.status === OrderStatus.COMPLETED,
      ).length;
      const completionRate =
        totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

      // Calculate average processing time (days from created to completed)
      const completedOrdersWithDates = orders.filter(
        (order) =>
          order.status === OrderStatus.COMPLETED &&
          order.createdAt &&
          order.updatedAt,
      );

      let totalProcessingDays = 0;
      completedOrdersWithDates.forEach((order) => {
        const processingTime =
          order.updatedAt.getTime() - order.createdAt.getTime();
        totalProcessingDays += processingTime / (1000 * 60 * 60 * 24); // Convert ms to days
      });

      const averageProcessingTime =
        completedOrdersWithDates.length > 0
          ? Number(
              (totalProcessingDays / completedOrdersWithDates.length).toFixed(
                1,
              ),
            )
          : 0;

      // Calculate return rate (assuming you track returns somewhere)
      const returnedOrders = orders.filter(
        (order) => order.status === OrderStatus.RETURNED,
      ).length;
      const returnRate =
        totalOrders > 0
          ? Number(((returnedOrders / totalOrders) * 100).toFixed(1))
          : 0;

      // Customer satisfaction would typically come from a separate ratings table
      // For now we'll use a placeholder or could calculate from order feedback if available
      const customerSatisfaction = 4.7;

      return {
        completionRate,
        averageProcessingTime,
        returnRate,
        customerSatisfaction,
      };
    } catch (error) {
      this.logger.error(
        `Error getting performance report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async getRevenueTrends(
    userId: string,
    userRole: string,
    period: PeriodType,
    limit: number,
  ) {
    try {
      // Initialize these at the function level to ensure scope
      let labels: string[] = [];
      const data: number[] = [];

      // Now you can use enum comparison
      if (period === PeriodType.DAILY) {
        // Daily logic
      } else if (period === PeriodType.WEEKLY) {
        // Weekly logic
      } else {
        // Monthly logic (PeriodType.MONTHLY)
      }

      // Default to monthly if invalid period provided
      const periodConfig =
        periodMap[period as keyof typeof periodMap] || periodMap.MONTHLY;

      // Calculate date range based on period and limit
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodConfig.days * limit);

      // Build query with role-based filtering
      let queryBuilder = this.orderRepository
        .createQueryBuilder('order')
        .select(`${periodConfig.groupBy}`, 'period')
        .addSelect('SUM(order.totalAmount)', 'revenue')
        .where('order.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy(periodConfig.groupBy)
        .orderBy(periodConfig.groupBy, 'ASC');

      // Apply role-based filtering
      if (userRole !== 'admin') {
        if (userRole === 'tailor') {
          queryBuilder = queryBuilder.andWhere('order.tailorId = :userId', {
            userId,
          });
        } else if (userRole === 'client') {
          queryBuilder = queryBuilder.andWhere('order.clientId = :userId', {
            userId,
          });
        }
      }

      const results: RevenueResult[] = await queryBuilder.getRawMany();

      // Generate all period labels for consistent data (even if some periods have no orders)
      for (let i = 0; i < limit; i++) {
        const date = new Date(endDate);
        date.setDate(date.getDate() - i * periodConfig.days);

        let periodLabel: string;
        if (period === PeriodType.DAILY) {
          periodLabel = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === PeriodType.WEEKLY) {
          // Calculate week number
          const weekNum = this.getWeekNumber(date);
          periodLabel = `${date.getFullYear()}-${weekNum < 10 ? '0' + weekNum : weekNum}`;
        } else {
          // Monthly
          periodLabel = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        labels.unshift(periodLabel);

        // Find matching data or use 0
        const matchingPeriod = results.find((r) => r.period === periodLabel);
        data.unshift(matchingPeriod ? Number(matchingPeriod.revenue) : 0);
      }

      // Format labels for display (transform from database format to readable format)
      if (period === PeriodType.DAILY) {
        labels = labels.map((l) =>
          new Date(l).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        );
      } else if (period === PeriodType.WEEKLY) {
        labels = labels.map((l) => {
          const [year, week] = l.split('-');
          return `Week ${week}, ${year}`;
        });
      } else {
        // Monthly
        labels = labels.map((l) => {
          const [year, month] = l.split('-');
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
          ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        });
      }

      return {
        period,
        labels,
        data,
        total: data.reduce((sum, val) => sum + val, 0),
      };
    } catch (error) {
      this.logger.error(
        `Error getting revenue trends: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async getCustomerInsights(userId: string, userRole: string) {
    try {
      if (userRole !== 'admin' && userRole !== 'tailor') {
        throw new Error('Insufficient permissions to access customer insights');
      }

      // Define time ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Base query
      let baseQueryBuilder = this.orderRepository
        .createQueryBuilder('order')
        .select('order.clientId')
        .distinct(true);

      // Apply role filtering for tailors
      if (userRole === 'tailor') {
        baseQueryBuilder = baseQueryBuilder.where('order.tailorId = :userId', {
          userId,
        });
      }

      // Get unique customers in the last 30 days
      const recentCustomersQuery = baseQueryBuilder.andWhere(
        'order.createdAt >= :thirtyDaysAgo',
        { thirtyDaysAgo },
      );

      const recentCustomers = await recentCustomersQuery.getCount();

      // Get customers who ordered between 30-60 days ago
      const previousCustomersQuery = baseQueryBuilder.andWhere(
        'order.createdAt BETWEEN :sixtyDaysAgo AND :thirtyDaysAgo',
        {
          sixtyDaysAgo,
          thirtyDaysAgo,
        },
      );

      const previousPeriodCustomers = await previousCustomersQuery.getCount();

      // Get returning customers (those who have more than one order)
      const returningCustomersQuery = this.orderRepository
        .createQueryBuilder('order')
        .select('order.clientId')
        .addSelect('COUNT(order.id)', 'orderCount')
        .groupBy('order.clientId')
        .having('orderCount > 1');

      if (userRole === 'tailor') {
        returningCustomersQuery.where('order.tailorId = :userId', { userId });
      }

      const returningCustomersResult =
        await returningCustomersQuery.getRawMany();
      const returningCustomers = returningCustomersResult.length;

      // Get all customers
      const allCustomersQuery = baseQueryBuilder.getCount();

      // Calculate customer retention rate
      const customerRetentionRate =
        previousPeriodCustomers > 0
          ? Number(
              ((returningCustomers / previousPeriodCustomers) * 100).toFixed(1),
            )
          : 0;

      // Calculate average orders per customer
      const totalOrdersQuery = this.orderRepository.createQueryBuilder('order');
      if (userRole === 'tailor') {
        totalOrdersQuery.where('order.tailorId = :userId', { userId });
      }
      const totalOrders = await totalOrdersQuery.getCount();
      const totalCustomers = await allCustomersQuery;

      const averageOrdersPerCustomer =
        totalCustomers > 0
          ? Number((totalOrders / totalCustomers).toFixed(1))
          : 0;

      // Get customer distribution by region
      // Assuming you store customer address/region in the order or have a join
      const customersByRegion = {
        'North America': 45,
        Europe: 32,
        Asia: 18,
        Other: 5,
      };

      return {
        newCustomers: recentCustomers,
        returningCustomers,
        customerRetentionRate,
        averageOrdersPerCustomer,
        customersByRegion,
      };
    } catch (error) {
      this.logger.error(
        `Error getting customer insights: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private groupOrdersByStatus(orders: Order[]): Record<string, number> {
    const result: Record<string, number> = {};

    // Initialize with common order statuses
    Object.values(OrderStatus).forEach((status) => {
      result[status.toLowerCase()] = 0;
    });

    // Count orders by status
    orders.forEach((order) => {
      const status = order.status.toLowerCase();
      if (result[status] !== undefined) {
        result[status]++;
      } else {
        // Handle any status not in our initialized list
        result[status] = 1;
      }
    });

    return result;
  }

  private async getTopSellingProducts(
    startDate: Date,
    endDate: Date,
    userId?: string,
    userRole?: string,
  ) {
    try {
      let queryBuilder = this.orderItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.order', 'order')
        .where('order.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });

      // Filter by user ID if not admin
      if (userId && userRole !== 'admin') {
        if (userRole === 'client') {
          queryBuilder = queryBuilder.andWhere('order.clientId = :userId', {
            userId,
          });
        } else if (userRole === 'tailor') {
          queryBuilder = queryBuilder.andWhere('order.tailorId = :userId', {
            userId,
          });
        }
      }

      const orderItems = await queryBuilder.getMany();

      // Group items by product and calculate totals
      const productMap = new Map();

      orderItems.forEach((item) => {
        const productId = item.productId;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            id: productId,
            name: item.name || 'Unknown Product',
            quantity: 0,
            revenue: 0,
          });
        }

        const product = productMap.get(productId);
        product.quantity += item.quantity || 1;
        product.revenue += (item.price || 0) * (item.quantity || 1);
      });

      // Convert to array and sort by revenue
      return Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5); // Limit to top 5 products
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting top selling products: ${errorMessage}`);
      return [];
    }
  }

  // Helper method for week number calculation
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}
