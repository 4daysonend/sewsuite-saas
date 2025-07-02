import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepository: Repository<OrderStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    // Create a query runner
    const queryRunner = this.dataSource.createQueryRunner();

    // Start the transaction
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate the total from services
      const servicesTotal = createOrderDto.services.reduce(
        (sum, service) => sum + service.price,
        0,
      );

      // Calculate total cost
      const calculatedTotal = servicesTotal;

      // Create the order
      const order = queryRunner.manager.create(Order, {
        clientId: userId,
        tailorId: createOrderDto.tailorId,
        status: OrderStatus.PENDING,
        description: createOrderDto.description,
        totalAmount: calculatedTotal, // Use server-calculated amount
        dueDate: createOrderDto.dueDate,
        // Other fields...
      });

      // Save the order
      await queryRunner.manager.save(order);

      // Create and save order items
      if (createOrderDto.services && createOrderDto.services.length > 0) {
        const orderItems = createOrderDto.services.map((service) =>
          queryRunner.manager.create(OrderItem, {
            orderId: order.id,
            name: service.name,
            description: service.description,
            price: service.price,
            quantity: service.quantity || 1,
            // Other fields...
          }),
        );

        await queryRunner.manager.save(OrderItem, orderItems);
      }

      // Record initial status history
      const statusHistory = queryRunner.manager.create(OrderStatusHistory, {
        orderId: order.id,
        status: OrderStatus.PENDING,
        notes: 'Order created',
        userId: userId,
      });

      await queryRunner.manager.save(statusHistory);

      // Commit the transaction
      await queryRunner.commitTransaction();

      return order;
    } catch (error) {
      // Rollback the transaction in case of error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  }

  async initiatePayment(orderId: string): Promise<{ clientSecret: string }> {
    // Implementation for payment initiation
    // This would typically involve generating a payment intent with a payment provider like Stripe
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Placeholder for actual payment integration
    return {
      clientSecret: `pi_${Math.random().toString(36).substring(2, 15)}_secret_${Math.random().toString(36).substring(2, 15)}`,
    };
  }

  async updateOrderStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    userId: string,
    role: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId, userId, role);

    // Update the status
    order.status = updateStatusDto.status;

    // Create history entry
    const historyEntry = this.orderStatusHistoryRepository.create({
      orderId: order.id,
      status: updateStatusDto.status,
      message:
        updateStatusDto.notes || `Status changed to ${updateStatusDto.status}`,
      userId: userId,
    });

    // Save both order and history
    await this.orderStatusHistoryRepository.save(historyEntry);
    return this.orderRepository.save(order);
  }

  async findAll(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
    userId: string;
    role: string;
  }): Promise<Pagination<Order>> {
    const {
      page,
      limit,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      userId,
      role,
    } = params;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.client', 'client')
      .leftJoinAndSelect('order.tailor', 'tailor');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    if (minAmount) {
      queryBuilder.andWhere('order.totalAmount >= :minAmount', { minAmount });
    }

    if (maxAmount) {
      queryBuilder.andWhere('order.totalAmount <= :maxAmount', { maxAmount });
    }

    if (search) {
      queryBuilder.andWhere(
        '(order.id LIKE :search OR client.firstName LIKE :search OR client.lastName LIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    // Role-based filtering
    if (role === 'client') {
      queryBuilder.andWhere('order.clientId = :userId', { userId });
    } else if (role === 'tailor') {
      queryBuilder.andWhere('order.tailorId = :userId', { userId });
    }
    // Admin can see all orders

    // Order by creation date, newest first
    queryBuilder.orderBy('order.createdAt', 'DESC');

    return paginate(queryBuilder, { page, limit });
  }

  async findOne(orderId: string, userId: string, role: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'client', 'tailor'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check permissions
    if (role === 'client' && order.clientId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this order',
      );
    }

    if (role === 'tailor' && order.tailorId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this order',
      );
    }

    return order;
  }

  async cancelOrder(
    orderId: string,
    reason: string,
    userId: string,
    role: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId, userId, role);

    // Check if order can be cancelled
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}`,
      );
    }

    // Update the order
    order.status = OrderStatus.CANCELLED;
    // Save cancellation reason
    order.cancellationReason = reason; // Uncomment this line
    order.cancelledAt = new Date(); // You might want this too
    order.cancelledBy = userId; // And this

    return this.orderRepository.save(order);
  }

  async getOrderHistory(
    orderId: string,
    userId: string,
    role: string,
    options?: IPaginationOptions,
  ): Promise<Pagination<OrderStatusHistory>> {
    // First check permissions by loading the order
    await this.findOne(orderId, userId, role);

    // Use the orderStatusHistoryRepository to fetch actual history
    const queryBuilder = this.orderStatusHistoryRepository
      .createQueryBuilder('history')
      .where('history.orderId = :orderId', { orderId })
      .orderBy('history.timestamp', 'DESC');

    // Use the pagination from nestjs-typeorm-paginate
    return paginate<OrderStatusHistory>(
      queryBuilder,
      options || { page: 1, limit: 10 },
    );
  }
}
