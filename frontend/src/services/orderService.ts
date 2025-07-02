import api, { handleApiError } from '../lib/api';
import { Order, OrderStatus, OrderItem } from '../types/order';

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus | OrderStatus[];
  startDate?: string;
  endDate?: string;
  userId?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateOrderRequest {
  items: OrderItemInput[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    shippingAddress?: any;
  };
  notes?: string;
  paymentMethod?: string;
}

interface OrderItemInput {
  productId: string;
  quantity: number;
  customizations?: Record<string, any>;
}

class OrderService {
  // Create a new order
  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    try {
      const response = await api.post('/orders', orderData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get orders with pagination and filtering
  async getOrders(params: OrderQueryParams = {}): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    try {
      const response = await api.get('/orders', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get order by ID
  async getOrder(id: string): Promise<Order> {
    try {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update order status
  async updateOrderStatus(id: string, status: OrderStatus, notes?: string): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${id}/status`, { status, notes });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update order details
  async updateOrder(id: string, orderData: Partial<Order>): Promise<Order> {
    try {
      const response = await api.put(`/orders/${id}`, orderData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Delete order (admin only)
  async deleteOrder(id: string): Promise<void> {
    try {
      await api.delete(`/orders/${id}`);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Process payment for an order
  async processPayment(orderId: string, paymentData: any): Promise<any> {
    try {
      const response = await api.post(`/orders/${orderId}/payments`, paymentData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Generate invoice
  async generateInvoice(orderId: string): Promise<{ url: string }> {
    try {
      const response = await api.post(`/orders/${orderId}/invoice`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get order history/timeline
  async getOrderHistory(orderId: string): Promise<any[]> {
    try {
      const response = await api.get(`/orders/${orderId}/history`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

const orderService = new OrderService();
export default orderService;

// Mock implementation for testing
export const mockOrderService = {
  // Generate mock orders
  mockOrders: Array.from({ length: 30 }, (_, i) => ({
    id: `order-${i + 1}`,
    status: ['pending', 'processing', 'completed', 'cancelled'][i % 4] as OrderStatus,
    customer: {
      id: `user-${(i % 10) + 1}`,
      name: `Customer ${(i % 10) + 1}`,
      email: `customer${(i % 10) + 1}@example.com`
    },
    items: Array.from({ length: (i % 3) + 1 }, (_, j) => ({
      id: `item-${i}-${j}`,
      productId: `product-${(j % 5) + 1}`,
      name: `Product ${(j % 5) + 1}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: parseFloat((Math.random() * 100 + 20).toFixed(2))
    })),
    totalAmount: parseFloat((Math.random() * 200 + 50).toFixed(2)),
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    updatedAt: new Date(Date.now() - Math.floor(Math.random() * 15 * 24 * 60 * 60 * 1000)).toISOString()
  })),

  // Simulated network delay
  async simulateDelay(min = 200, max = 600): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  },

  // Mock implementations
  async getOrders(params: OrderQueryParams = {}): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    await this.simulateDelay();
    
    let filteredOrders = [...this.mockOrders];
    
    // Apply filters
    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      filteredOrders = filteredOrders.filter(order => statuses.includes(order.status));
    }
    
    if (params.searchTerm) {
      const searchTerm = params.searchTerm.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        order.id.toLowerCase().includes(searchTerm) ||
        order.customer.name.toLowerCase().includes(searchTerm) ||
        order.customer.email.toLowerCase().includes(searchTerm)
      );
    }
    
    if (params.startDate) {
      const startDate = new Date(params.startDate).getTime();
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.createdAt).getTime() >= startDate
      );
    }
    
    if (params.endDate) {
      const endDate = new Date(params.endDate).getTime();
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.createdAt).getTime() <= endDate
      );
    }
    
    if (params.userId) {
      filteredOrders = filteredOrders.filter(order => 
        order.customer.id === params.userId
      );
    }
    
    // Get total before pagination
    const total = filteredOrders.length;
    
    // Apply pagination
    const page = params.page || 1;
    const limit = params.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    filteredOrders = filteredOrders.slice(start, end);
    
    return {
      items: filteredOrders as Order[],
      total,
      page,
      limit
    };
  },
  
  async getOrder(id: string): Promise<Order> {
    await this.simulateDelay();
    const order = this.mockOrders.find(o => o.id === id);
    if (!order) throw new Error('Order not found');
    return order as Order;
  },
  
  // Implement other methods as needed for your mock service
};