export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PAYMENT_FAILED = 'payment_failed'
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  customizations?: Record<string, any>;
}

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface OrderPayment {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  createdAt: string;
}

export interface OrderHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  userName?: string;
  details?: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customer: OrderCustomer;
  items: OrderItem[];
  totalAmount: number;
  payments?: OrderPayment[];
  history?: OrderHistoryEntry[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
  estimatedDeliveryDate?: string;
}