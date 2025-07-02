import { createCrudService } from './service-factory';
import { Order } from '../types/order';
import { get, post } from '../lib/api';

// Create a base CRUD service
const baseOrderService = createCrudService<Order>('orders');

// Extend it with order-specific endpoints
const orderService = {
  ...baseOrderService,
  
  // Get orders with detailed filtering
  getOrders: async (params?: any) => {
    return get<{ items: Order[], meta: { totalItems: number, page: number, limit: number } }>(
      '/orders',
      { params }
    );
  },
  
  // Get a specific order
  getOrder: async (id: string) => {
    return get<Order>(`/orders/${id}`);
  },
  
  // Update order status
  updateOrderStatus: async (id: string, status: string, notes?: string) => {
    return post<Order>(`/orders/${id}/status`, { status, notes });
  },
  
  // Cancel an order
  cancelOrder: async (id: string, reason: string) => {
    return post<Order>(`/orders/${id}/cancel`, { reason });
  }
};

export default orderService;