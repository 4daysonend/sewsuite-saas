import { IPaginationMeta } from 'nestjs-typeorm-paginate';

export interface Pagination<T> {
  items: T[];
  meta: IPaginationMeta;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}
