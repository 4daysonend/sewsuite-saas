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

    // Add the new properties here
    cpuUsage: number;
    memoryUsage: number;
    activeUsers: number;
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
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
    cpuUsage: number;
    memoryUsage: number;
    activeUsers: number;
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  }

  export interface MetricTimeSeriesPoint {
    timestamp: string;
    value: number;
  }

  export type ErrorLogLevel = 'error' | 'warning' | 'info';

  export interface ErrorLogEntry {
    id: string;
    timestamp: string;
    level: ErrorLogLevel;
    message: string;
    stack?: string;
    userId?: string;
    path: string;
    metadata?: Record<string, any>;
  }

  export type AlertLevel = 'critical' | 'high' | 'medium' | 'low';

  export interface SystemAlert {
    id: string;
    timestamp: string;
    level: AlertLevel;
    title: string;
    message: string;
    metric: string;
    thresholdValue: number;
    currentValue: number;
    isResolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNotes?: string;
  }