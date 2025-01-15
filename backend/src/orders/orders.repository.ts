import { Repository, EntityRepository, Brackets } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderFilter } from './interfaces/order-filter.interface';
import { Pagination } from '../common/interfaces/pagination.interface';

@EntityRepository(Order)
export class OrderRepository extends Repository<Order> {
  async findWithFilters(filter: OrderFilter): Promise<Pagination<Order>> {
    const queryBuilder = this.createQueryBuilder('order')
      .leftJoinAndSelect('order.client', 'client')
      .leftJoinAndSelect('order.tailor', 'tailor');

    // Apply role-based filtering
    if (filter.role === 'client') {
      queryBuilder.where('client.id = :userId', { userId: filter.userId });
    } else if (filter.role === 'tailor') {
      queryBuilder.where('tailor.id = :userId', { userId: filter.userId });
    }

    // Apply status filter
    if (filter.status) {
      queryBuilder.andWhere('order.status = :status', {
        status: filter.status,
      });
    }

    // Apply date range filter
    if (filter.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', {
        startDate: new Date(filter.startDate),
      });
    }
    if (filter.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', {
        endDate: new Date(filter.endDate),
      });
    }

    // Apply amount range filter
    if (filter.minAmount) {
      queryBuilder.andWhere('order.price >= :minAmount', {
        minAmount: filter.minAmount,
      });
    }
    if (filter.maxAmount) {
      queryBuilder.andWhere('order.price <= :maxAmount', {
        maxAmount: filter.maxAmount,
      });
    }

    // Apply search filter
    if (filter.search) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('order.description ILIKE :search', {
            search: `%${filter.search}%`,
          })
            .orWhere('client.firstName ILIKE :search', {
              search: `%${filter.search}%`,
            })
            .orWhere('client.lastName ILIKE :search', {
              search: `%${filter.search}%`,
            })
            .orWhere('tailor.firstName ILIKE :search', {
              search: `%${filter.search}%`,
            })
            .orWhere('tailor.lastName ILIKE :search', {
              search: `%${filter.search}%`,
            });
        }),
      );
    }

    // Add sorting
    queryBuilder.orderBy('order.createdAt', 'DESC');

    // Apply pagination
    const skip = (filter.page - 1) * filter.limit;
    queryBuilder.skip(skip).take(filter.limit);

    // Execute query
    const [items, totalItems] = await queryBuilder.getManyAndCount();

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / filter.limit);

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: filter.limit,
        totalPages,
        currentPage: filter.page,
      },
    };
  }
}
