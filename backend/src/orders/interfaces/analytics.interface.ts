// /backend/src/orders/interfaces/analytics.interface.ts
export interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  revenueByPeriod: Array<{
    period: string;
    revenue: number;
    orderCount: number;
  }>;
  customerMetrics?: {
    totalCustomers: number;
    repeatCustomers: number;
    averageOrdersPerCustomer: number;
  };
  performanceMetrics?: {
    completionRate: number;
    averageCompletionTime: number;
    cancelationRate: number;
  };
}