import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

@Injectable()
export class OrderAnalyticsService {
  private readonly logger = new Logger(OrderAnalyticsService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getAnalytics(userId: string, startDate: Date, endDate: Date) {
    try {
      const orders = await this.orderRepository
        .createQueryBuilder('order')
        .where('order.userId = :userId', { userId })
        .andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .getMany();

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + order.price, 0);
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const dailyRevenue = this.calculateDailyRevenue(orders);
      const ordersByStatus = this.groupOrdersByStatus(orders);

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        dailyRevenue,
        ordersByStatus,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get analytics: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      );
      throw error;
    }
  }

  private calculateDailyRevenue(orders: Order[]): Record<string, number> {
    return orders.reduce(
      (acc, order) => {
        const date = order.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + order.price;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private groupOrdersByStatus(orders: Order[]): Record<string, number> {
    return orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}
