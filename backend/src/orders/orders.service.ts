// /backend/src/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { EmailService } from '../email/email.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly emailService: EmailService,
  ) {}

  async create(user: User, createOrderDto: CreateOrderDto): Promise<Order> {
    const order = this.ordersRepository.create({
      ...createOrderDto,
      clientId: user.id, // Use clientId instead of user
      // You could also do this if you need to access user properties:
      // client: user,
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Send confirmation email
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Order Confirmation',
      html: `<h1>Order Confirmed</h1><p>Your order #${savedOrder.id} has been received.</p>`,
      text: `Order Confirmed\nYour order #${savedOrder.id} has been received.`,
    });

    return savedOrder;
  }

  async findAll(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { clientId: userId }, // Use clientId instead of user.id
      relations: ['client'], // Use client instead of user
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['client'], // Use client instead of user
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateData: { status: OrderStatus; notes?: string },
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.status = updateData.status;

    // Optionally store notes in history or metadata
    if (updateData.notes) {
      if (!order.metadata) {
        order.metadata = {};
      }

      if (!order.metadata.statusHistory) {
        order.metadata.statusHistory = [];
      }

      order.metadata.statusHistory.push({
        status: updateData.status,
        notes: updateData.notes,
        date: new Date(),
      });
    }

    const updatedOrder = await this.ordersRepository.save(order);

    // Send status update email
    if (order.client?.email) {
      await this.emailService.sendEmail({
        to: order.client.email,
        subject: 'Order Status Update',
        html: `<h1>Order Status Updated</h1><p>Your order #${id} status has been updated to: ${updateData.status}</p>`,
        text: `Order Status Updated\nYour order #${id} status has been updated to: ${updateData.status}`,
      });
    }

    return updatedOrder;
  }

  async cancel(id: string): Promise<Order> {
    const order = await this.findOne(id);
    order.status = OrderStatus.CANCELLED;

    return this.ordersRepository.save(order);
  }

  async getOrderHistory(orderId: string, userId: string, userRole: string) {
    // First check if the order exists and if the user has access to it
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['client'],
    });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    // Check permissions
    if (userRole !== 'admin' && order.clientId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this order history',
      );
    }

    // Return order history
    // This is just an example - in a real application you would likely
    // have an OrderHistory entity and repository
    return [
      {
        timestamp: order.createdAt,
        status: OrderStatus.PENDING_PAYMENT,
        message: 'Order created',
        userId: order.clientId,
      },
      // You would fetch actual history entries from your database here
    ];
  }
}
