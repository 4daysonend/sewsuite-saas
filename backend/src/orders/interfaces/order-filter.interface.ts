import { OrderStatus } from '../entities/order.entity';

export interface OrderFilter {
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
}