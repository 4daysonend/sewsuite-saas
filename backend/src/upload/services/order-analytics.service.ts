import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderRepository } from '../orders.repository';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { OrderAnalytics } from '../interfaces/analytics.interface';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class OrderAnalyticsService {
  private readonly logger = new Logger(OrderAnalyticsService.name);

  constructor(
    @InjectRepository(OrderRepository)
    private readonly orderRepository: OrderRepository
  ) {}

  async getAnalyticsSummary(
    userId: string,
    role: string,
    startDate?: string,
    endDate?: string
  ): Promise<OrderAnalytics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);
      const baseQuery = this.orderRepository.createQueryBuilder('order')
        .leftJoinAndSelect('order.client', 'client')
        .leftJoinAndSelect('order.tailor', 'tailor');

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

      // Get basic metrics
      const orders = await baseQuery.getMany();
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + Number(order.price), 0);

      // Get orders by status
      const ordersByStatus = await this.getOrdersByStatus(baseQuery);

      // Get revenue by period
      const revenueByPeriod = await this.getRevenueByPeriod(baseQuery);

      // Get customer metrics
      const customer