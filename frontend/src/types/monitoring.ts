// sewsuite-saas\frontend\src\types\monitoring.ts
export interface Alert {
    id: string;
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    component: string;
    timestamp: string;
    status: 'active' | 'resolved';
    metadata?: Record<string, any>;
  }
  
  export interface SystemPerformance {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    loadAverage: number[];
  }
  
  export interface ApiMetrics {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{
      path: string;
      method: string;
      count: number;
      averageResponseTime: number;
    }>;
  }
  
  export interface QueueMetrics {
    [queueName: string]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      errorRate: number;
      processingTime: number;
    };
  }
  
  export interface SystemStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      database: 'healthy' | 'degraded' | 'unhealthy';
      redis: 'healthy' | 'degraded' | 'unhealthy';
      storage: 'healthy' | 'degraded' | 'unhealthy';
      queues: 'healthy' | 'degraded' | 'unhealthy';
    };
  }
  
  export interface SystemMetrics {
    status: SystemStatus;
    performance: SystemPerformance;
    queues: QueueMetrics;
    api: ApiMetrics;
    alerts: Alert[];
    timestamp: string;
  }