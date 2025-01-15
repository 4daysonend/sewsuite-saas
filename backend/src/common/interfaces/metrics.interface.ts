export interface SystemMetrics {
  errors: {
    total: number;
    rate: number;
    byComponent: Record<string, number>;
    timeline: Array<{
      timestamp: Date;
      count: number;
      component: string;
    }>;
  };
  uploads: {
    total: number;
    successful: number;
    failed: number;
    averageSize: number;
    averageDuration: number;
    successRate: number;
  };
  api: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{
      path: string;
      method: string;
      count: number;
      averageResponseTime: number;
    }>;
  };
  performance: {
    cpu: number;
    memory: number;
    activeConnections: number;
    queueLength: number;
  };
}
