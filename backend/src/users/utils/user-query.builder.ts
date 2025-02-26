import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../entities/user.entity';
import { QueryUsersDto } from '../dto/query-users.dto';

@Injectable()
export class UserQueryBuilder {
  buildQuery(
    repo: Repository<User>,
    queryDto: QueryUsersDto,
  ): SelectQueryBuilder<User> {
    const {
      role,
      isActive,
      isVerified,
      searchTerm,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const query = repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.subscriptions', 'subscription')
      .leftJoinAndSelect('user.clientOrders', 'clientOrder')
      .leftJoinAndSelect('user.tailorOrders', 'tailorOrder');

    // Apply filters
    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    if (typeof isActive === 'boolean') {
      query.andWhere('user.isActive = :isActive', { isActive });
    }

    if (typeof isVerified === 'boolean') {
      query.andWhere('user.emailVerified = :isVerified', { isVerified });
    }

    // Apply search
    if (searchTerm) {
      query.andWhere(
        new RegExp(
          '(LOWER(user.email) LIKE LOWER(:search) OR ' +
            'LOWER(user.firstName) LIKE LOWER(:search) OR ' +
            'LOWER(user.lastName) LIKE LOWER(:search))',
          'g',
        ),
        { search: `%${searchTerm}%` },
      );
    }

    // Apply sorting
    if (sortBy && sortOrder) {
      query.orderBy(`user.${sortBy}`, sortOrder);
    }

    return query;
  }
}
