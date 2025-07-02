export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  revenueByPeriod: {
    period: string;
    revenue: number;
    orderCount: number;
  }[];
  // Add any other properties returned by your analytics service
}
