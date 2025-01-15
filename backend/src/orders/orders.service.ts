import { Injectable, NotFoundException } from '@nestjs/common';
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
      user,
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
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;

    const updatedOrder = await this.ordersRepository.save(order);

    // Send status update email
    await this.emailService.sendEmail({
      to: order.user.email,
      subject: 'Order Status Update',
      html: `<h1>Order Status Updated</h1><p>Your order #${id} status has been updated to: ${status}</p>`,
      text: `Order Status Updated\nYour order #${id} status has been updated to: ${status}`,
    });

    return updatedOrder;
  }

  async cancel(id: string): Promise<Order> {
    const order = await this.findOne(id);
    order.status = OrderStatus.CANCELLED;

    return this.ordersRepository.save(order);
  }
}
