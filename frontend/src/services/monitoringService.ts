import api, { handleApiError } from '../lib/api';
import { 
  SystemMetrics, 
  MetricTimeSeriesPoint, 
  ErrorLogEntry,
  SystemAlert
} from '../types/monitoring';

export interface MetricsQueryParams {
  startTime?: string;
  endTime?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}

export interface ErrorLogsQueryParams {
  level?: 'error' | 'warning' | 'info';
  startTime?: string;
  endTime?: string;
  userId?: string;
  path?: string;
  page?: number;
  limit?: number;
}

export interface AlertsQueryParams {
  level?: 'critical' | 'high' | 'medium' | 'low';
  isResolved?: boolean;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

class MonitoringService {
  // Get current system metrics
  async getCurrentMetrics(): Promise<SystemMetrics> {
    try {
      const response = await api.get('/monitoring/metrics/current');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get CPU usage time series
  async getCpuMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/cpu', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get memory usage time series
  async getMemoryMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/memory', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get requests per minute time series
  async getRequestMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/requests', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get response time metrics
  async getResponseTimeMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/response-time', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get error rate metrics
  async getErrorRateMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/error-rate', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get error logs
  async getErrorLogs(params: ErrorLogsQueryParams = {}): Promise<{ logs: ErrorLogEntry[]; total: number }> {
    try {
      const response = await api.get('/monitoring/logs/errors', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get system alerts
  async getSystemAlerts(params: AlertsQueryParams = {}): Promise<{ alerts: SystemAlert[]; total: number }> {
    try {
      const response = await api.get('/monitoring/alerts', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Resolve a system alert
  async resolveAlert(alertId: string, notes?: string): Promise<SystemAlert> {
    try {
      const response = await api.post(`/monitoring/alerts/${alertId}/resolve`, { notes });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get system health status
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; issues: string[] }> {
    try {
      const response = await api.get('/monitoring/health');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

const monitoringService = new MonitoringService();
export default monitoringService;

// Mock implementation for testing
export const mockMonitoringService = {
  async simulateDelay(min = 100, max = 400): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  },
  
  generateTimeSeriesData(hours = 24, interval = 5, minValue = 0, maxValue = 100, trend: 'up' | 'down' | 'stable' | 'fluctuate' = 'fluctuate'): MetricTimeSeriesPoint[] {
    const points: MetricTimeSeriesPoint[] = [];
    const now = new Date();
    const intervalMs = interval * 60 * 1000; // Convert minutes to ms
    let value = (minValue + maxValue) / 2;
    
    for (let i = hours * 60 / interval; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * intervalMs)).toISOString();
      
      // Adjust value based on trend
      switch(trend) {
        case 'up':
          value += Math.random() * (maxValue - minValue) * 0.05;
          break;
        case 'down':
          value -= Math.random() * (maxValue - minValue) * 0.05;
          break;
        case 'stable':
          value += (Math.random() - 0.5) * (maxValue - minValue) * 0.01;
          break;
        case 'fluctuate':
        default:
          value += (Math.random() - 0.5) * (maxValue - minValue) * 0.1;
          break;
      }
      
      // Keep within bounds
      value = Math.max(minValue, Math.min(maxValue, value));
      
      points.push({ timestamp, value: parseFloat(value.toFixed(2)) });
    }
    
    return points;
  },

  async getCurrentMetrics(): Promise<SystemMetrics> {
    await this.simulateDelay();
    
    return {
      cpuUsage: parseFloat((Math.random() * 40 + 20).toFixed(1)),
      memoryUsage: parseFloat((Math.random() * 30 + 40).toFixed(1)),
      activeUsers: Math.floor(Math.random() * 50 + 10),
      requestsPerMinute: Math.floor(Math.random() * 200 + 50),
      averageResponseTime: parseFloat((Math.random() * 200 + 50).toFixed(1)),
      errorRate: parseFloat((Math.random() * 2).toFixed(2))
    };
  },

  async getCpuMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 10, 90, 'fluctuate');
  },

  async getMemoryMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 30, 80, 'up');
  },

  async getRequestMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 20, 300, 'fluctuate');
  },

  async getResponseTimeMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 50, 500, 'stable');
  },

  async getErrorRateMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 0, 5, 'down');
  },

  mockErrorLogs: Array.from({ length: 30 }, (_, i) => ({
    id: `error-${i + 1}`,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)).toISOString(),
    level: ['error', 'warning', 'info'][i % 3] as 'error' | 'warning' | 'info',
    message: [
      'Failed to process payment',
      'Database connection timeout',
      'Invalid user input',
      'File upload failed',
      'API rate limit exceeded',
      'Authentication failed',
      'Email delivery failed',
      'Processing timeout',
      'External API error',
      'Cache invalidation failed'
    ][i % 10],
    stack: i % 3 === 0 ? 'Error: Failed to process\n    at processPayment (/app/services/payment.js:42:7)\n    at checkout (/app/controllers/order.js:105:18)' : undefined,
    userId: i % 4 === 0 ? `user-${(i % 5) + 1}` : undefined,
    path: [
      '/api/payments',
      '/api/orders',
      '/api/users',
      '/api/uploads',
      '/api/auth'
    ][i % 5],
    metadata: i % 3 === 0 ? { orderId: `order-${(i % 10) + 1}`, attempt: Math.floor(Math.random() * 3) + 1 } : undefined
  })),

  mockAlerts: Array.from({ length: 15 }, (_, i) => ({
    id: `alert-${i + 1}`,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3)).toISOString(),
    level: ['critical', 'high', 'medium', 'low'][i % 4] as 'critical' | 'high' | 'medium' | 'low',
    title: [
      'High CPU Usage',
      'Memory Usage Critical',
      'Database Connection Pool Exhausted',
      'API Error Rate Spike',
      'Slow Response Time',
      'Storage Space Low',
      'Queue Backlog',
      'Cache Hit Rate Low'
    ][i % 8],
    message: `System detected an issue with ${
      ['CPU usage', 'memory usage', 'database connections', 'API error rate', 'response times', 'storage space', 'queue processing', 'cache efficiency'][i % 8]
    } exceeding the defined threshold.`,
    metric: [
      'cpu_usage',
      'memory_usage',
      'db_connections',
      'error_rate',
      'response_time',
      'disk_space',
      'queue_depth',
      'cache_hit_rate'
    ][i % 8],
    thresholdValue: [80, 90, 100, // filepath: c:\Users\PSXLHP276\sewsuite-saas\frontend\src\services\monitoringService.ts
import api, { handleApiError } from '../lib/api';
import { 
  SystemMetrics, 
  MetricTimeSeriesPoint, 
  ErrorLogEntry,
  SystemAlert
} from '../types/monitoring';

export interface MetricsQueryParams {
  startTime?: string;
  endTime?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}

export interface ErrorLogsQueryParams {
  level?: 'error' | 'warning' | 'info';
  startTime?: string;
  endTime?: string;
  userId?: string;
  path?: string;
  page?: number;
  limit?: number;
}

export interface AlertsQueryParams {
  level?: 'critical' | 'high' | 'medium' | 'low';
  isResolved?: boolean;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

class MonitoringService {
  // Get current system metrics
  async getCurrentMetrics(): Promise<SystemMetrics> {
    try {
      const response = await api.get('/monitoring/metrics/current');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get CPU usage time series
  async getCpuMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/cpu', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get memory usage time series
  async getMemoryMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/memory', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get requests per minute time series
  async getRequestMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/requests', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get response time metrics
  async getResponseTimeMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/response-time', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get error rate metrics
  async getErrorRateMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    try {
      const response = await api.get('/monitoring/metrics/error-rate', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get error logs
  async getErrorLogs(params: ErrorLogsQueryParams = {}): Promise<{ logs: ErrorLogEntry[]; total: number }> {
    try {
      const response = await api.get('/monitoring/logs/errors', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get system alerts
  async getSystemAlerts(params: AlertsQueryParams = {}): Promise<{ alerts: SystemAlert[]; total: number }> {
    try {
      const response = await api.get('/monitoring/alerts', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Resolve a system alert
  async resolveAlert(alertId: string, notes?: string): Promise<SystemAlert> {
    try {
      const response = await api.post(`/monitoring/alerts/${alertId}/resolve`, { notes });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get system health status
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; issues: string[] }> {
    try {
      const response = await api.get('/monitoring/health');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

const monitoringService = new MonitoringService();
export default monitoringService;

// Mock implementation for testing
export const mockMonitoringService = {
  async simulateDelay(min = 100, max = 400): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  },
  
  generateTimeSeriesData(hours = 24, interval = 5, minValue = 0, maxValue = 100, trend: 'up' | 'down' | 'stable' | 'fluctuate' = 'fluctuate'): MetricTimeSeriesPoint[] {
    const points: MetricTimeSeriesPoint[] = [];
    const now = new Date();
    const intervalMs = interval * 60 * 1000; // Convert minutes to ms
    let value = (minValue + maxValue) / 2;
    
    for (let i = hours * 60 / interval; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * intervalMs)).toISOString();
      
      // Adjust value based on trend
      switch(trend) {
        case 'up':
          value += Math.random() * (maxValue - minValue) * 0.05;
          break;
        case 'down':
          value -= Math.random() * (maxValue - minValue) * 0.05;
          break;
        case 'stable':
          value += (Math.random() - 0.5) * (maxValue - minValue) * 0.01;
          break;
        case 'fluctuate':
        default:
          value += (Math.random() - 0.5) * (maxValue - minValue) * 0.1;
          break;
      }
      
      // Keep within bounds
      value = Math.max(minValue, Math.min(maxValue, value));
      
      points.push({ timestamp, value: parseFloat(value.toFixed(2)) });
    }
    
    return points;
  },

  async getCurrentMetrics(): Promise<SystemMetrics> {
    await this.simulateDelay();
    
    return {
      cpuUsage: parseFloat((Math.random() * 40 + 20).toFixed(1)),
      memoryUsage: parseFloat((Math.random() * 30 + 40).toFixed(1)),
      activeUsers: Math.floor(Math.random() * 50 + 10),
      requestsPerMinute: Math.floor(Math.random() * 200 + 50),
      averageResponseTime: parseFloat((Math.random() * 200 + 50).toFixed(1)),
      errorRate: parseFloat((Math.random() * 2).toFixed(2))
    };
  },

  async getCpuMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 10, 90, 'fluctuate');
  },

  async getMemoryMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 30, 80, 'up');
  },

  async getRequestMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 20, 300, 'fluctuate');
  },

  async getResponseTimeMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 50, 500, 'stable');
  },

  async getErrorRateMetrics(params: MetricsQueryParams = {}): Promise<MetricTimeSeriesPoint[]> {
    await this.simulateDelay();
    return this.generateTimeSeriesData(24, 5, 0, 5, 'down');
  },

  mockErrorLogs: Array.from({ length: 30 }, (_, i) => ({
    id: `error-${i + 1}`,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)).toISOString(),
    level: ['error', 'warning', 'info'][i % 3] as 'error' | 'warning' | 'info',
    message: [
      'Failed to process payment',
      'Database connection timeout',
      'Invalid user input',
      'File upload failed',
      'API rate limit exceeded',
      'Authentication failed',
      'Email delivery failed',
      'Processing timeout',
      'External API error',
      'Cache invalidation failed'
    ][i % 10],
    stack: i % 3 === 0 ? 'Error: Failed to process\n    at processPayment (/app/services/payment.js:42:7)\n    at checkout (/app/controllers/order.js:105:18)' : undefined,
    userId: i % 4 === 0 ? `user-${(i % 5) + 1}` : undefined,
    path: [
      '/api/payments',
      '/api/orders',
      '/api/users',
      '/api/uploads',
      '/api/auth'
    ][i % 5],
    metadata: i % 3 === 0 ? { orderId: `order-${(i % 10) + 1}`, attempt: Math.floor(Math.random() * 3) + 1 } : undefined
  })),

  mockAlerts: Array.from({ length: 15 }, (_, i) => ({
    id: `alert-${i + 1}`,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3)).toISOString(),
    level: ['critical', 'high', 'medium', 'low'][i % 4] as 'critical' | 'high' | 'medium' | 'low',
    title: [
      'High CPU Usage',
      'Memory Usage Critical',
      'Database Connection Pool Exhausted',
      'API Error Rate Spike',
      'Slow Response Time',
      'Storage Space Low',
      'Queue Backlog',
      'Cache Hit Rate Low'
    ][i % 8],
    message: `System detected an issue with ${
      ['CPU usage', 'memory usage', 'database connections', 'API error rate', 'response times', 'storage space', 'queue processing', 'cache efficiency'][i % 8]
    } exceeding the defined threshold.`,
    metric: [
      'cpu_usage',
      'memory_usage',
      'db_connections',
      'error_rate',
      'response_time',
      'disk_space',
      'queue_depth',
      'cache_hit_rate'
    ][i % 8],
    thresholdValue: [80, 90, 100, 