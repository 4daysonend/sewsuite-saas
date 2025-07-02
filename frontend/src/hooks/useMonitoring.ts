import { useState, useEffect, useCallback } from 'react';
import monitoringService, { mockMonitoringService } from '../services/monitoringService';
import { SystemMetrics, MetricTimeSeriesPoint } from '../types/monitoring';
import { useMockServices } from '../utils/environment';

// Hook for system metrics
export function useSystemMetrics(refreshInterval = 60000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const service = useMockServices ? mockMonitoringService : monitoringService;

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await service.getCurrentMetrics();
      setMetrics(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load system metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchMetrics();
    
    // Set up refresh interval if specified
    if (refreshInterval > 0) {
      const intervalId = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchMetrics, refreshInterval]);

  return { metrics, loading, error, refreshMetrics: fetchMetrics };
}

// Hook for metric time series data
export function useMetricTimeSeries(
  metricType: 'cpu' | 'memory' | 'requests' | 'response-time' | 'error-rate',
  params = {}
) {
  const [data, setData] = useState<MetricTimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const service = useMockServices ? mockMonitoringService : monitoringService;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let result: MetricTimeSeriesPoint[];
      
      switch (metricType) {
        case 'cpu':
          result = await service.getCpuMetrics(params);
          break;
        case 'memory':
          result = await service.getMemoryMetrics(params);
          break;
        case 'requests':
          result = await service.getRequestMetrics(params);
          break;
        case 'response-time':
          result = await service.getResponseTimeMetrics(params);
          break;
        case 'error-rate':
          result = await service.getErrorRateMetrics(params);
          break;
        default:
          throw new Error(`Unknown metric type: ${metricType}`);
      }
      
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to load ${metricType} metrics`;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [metricType, params, service]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refreshData: fetchData };
}