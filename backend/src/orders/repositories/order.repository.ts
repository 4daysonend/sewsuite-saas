import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }

  // Custom methods for querying orders

  async findByClientId(clientId: string): Promise<Order[]> {
    return this.find({ where: { clientId } });
  }

  async findByTailorId(tailorId: string): Promise<Order[]> {
    return this.find({ where: { tailorId } });
  }

  async findWithDetailsByStatus(status: string): Promise<Order[]> {
    return this.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.client', 'client')
      .leftJoinAndSelect('order.tailor', 'tailor')
      .where('order.status = :status', { status })
      .getMany();
  }

  async findWithAdvancedFilters(filters: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    searchTerm?: string;
    clientId?: string;
    tailorId?: string;
  }): Promise<Order[]> {
    const query = this.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.client', 'client')
      .leftJoinAndSelect('order.tailor', 'tailor');

    if (filters.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters.startDate && filters.endDate) {
      query.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters.minAmount) {
      query.andWhere('order.totalAmount >= :minAmount', {
        minAmount: filters.minAmount,
      });
    }

    if (filters.maxAmount) {
      query.andWhere('order.totalAmount <= :maxAmount', {
        maxAmount: filters.maxAmount,
      });
    }

    if (filters.searchTerm) {
      query.andWhere(
        '(client.firstName LIKE :term OR client.lastName LIKE :term OR order.id LIKE :term)',
        {
          term: `%${filters.searchTerm}%`,
        },
      );
    }

    if (filters.clientId) {
      query.andWhere('order.clientId = :clientId', {
        clientId: filters.clientId,
      });
    }

    if (filters.tailorId) {
      query.andWhere('order.tailorId = :tailorId', {
        tailorId: filters.tailorId,
      });
    }

    return query.getMany();
  }
}
