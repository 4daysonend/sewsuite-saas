import axios from 'axios';
import { API_URL, useMockServices } from '../utils/environment';
import { mockMonitoringData } from '../mocks/monitoring.mock';

class MonitoringService {
  async getPerformanceMetrics(timeframe: string) {
    if (useMockServices) {
      return this.getMockPerformanceMetrics(timeframe);
    }
    
    const response = await axios.get(`${API_URL}/monitoring/metrics`, {
      params: { timeframe },
      headers: this.getAuthHeaders()
    });
    
    return response.data;
  }
  
  async getHealthStatus() {
    if (useMockServices) {
      return this.getMockHealthStatus();
    }
    
    const response = await axios.get(`${API_URL}/monitoring/health`);
    return response.data;
  }
  
  async getAlerts(params: { status?: string, limit?: number } = {}) {
    if (useMockServices) {
      return this.getMockAlerts(params);
    }
    
    const response = await axios.get(`${API_URL}/monitoring/alerts`, {
      params,
      headers: this.getAuthHeaders()
    });
    
    return response.data;
  }
  
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }
  
  // Mock implementations for development
  private getMockPerformanceMetrics(timeframe: string) {
    // Return different data based on timeframe
    const mockData = mockMonitoringData.metrics;
    
    // Adjust historical data length based on timeframe
    const dataPoints = 
      timeframe === '5m' ? 5 :
      timeframe === '1h' ? 12 :
      timeframe === '24h' ? 24 :
      timeframe === '7d' ? 28 : 12;
      
    // Generate mock historical data
    const historical = {
      cpu: Array.from({ length: dataPoints }).map((_, i) => ({
        timestamp: new Date(Date.now() - i * (timeframe === '5m' ? 60000 : 
                                             timeframe === '1h' ? 300000 : 
                                             timeframe === '24h' ? 3600000 : 21600000)).toISOString(),
        usage: 30 + Math.random() * 20
      })).reverse(),
      memory: Array.from({ length: dataPoints }).map((_, i) => ({
        timestamp: new Date(Date.now() - i * (timeframe === '5m' ? 60000 : 
                                             timeframe === '1h' ? 300000 : 
                                             timeframe === '24h' ? 3600000 : 21600000)).toISOString(),
        usage: 50 + Math.random() * 15
      })).reverse(),
      connections: Array.from({ length: dataPoints }).map((_, i) => ({
        timestamp: new Date(Date.now() - i * (timeframe === '5m' ? 60000 : 
                                             timeframe === '1h' ? 300000 : 
                                             timeframe === '24h' ? 3600000 : 21600000)).toISOString(),
        connections: Math.floor(120 + Math.random() * 50)
      })).reverse(),
      requests: Array.from({ length: dataPoints }).map((_, i) => ({
        timestamp: new Date(Date.now() - i * (timeframe === '5m' ? 60000 : 
                                             timeframe === '1h' ? 300000 : 
                                             timeframe === '24h' ? 3600000 : 21600000)).toISOString(),
        success: Math.floor(80 + Math.random() * 40),
        error: Math.floor(Math.random() * 8),
        latency: 150 + Math.random() * 100
      })).reverse(),
    };
    
    return { 
      metrics: mockData,
      historical
    };
  }
  
  private getMockHealthStatus() {
    return mockMonitoringData.health;
  }
  
  private getMockAlerts(params: { status?: string, limit?: number } = {}) {
    let alerts = mockMonitoringData.alerts;
    
    if (params.status) {
      alerts = alerts.filter(alert => alert.status === params.status);
    }
    
    if (params.limit) {
      alerts = alerts.slice(0, params.limit);
    }
    
    return alerts;
  }
}

const monitoringService = new MonitoringService();
export default monitoringService;