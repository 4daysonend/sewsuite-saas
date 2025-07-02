import { performance } from 'perf_hooks';
import api from '../../lib/api';

// Test pagination with large datasets
export const testPagination = async (endpoint: string, pageSize: number, totalPages: number) => {
  const results = [];
  
  for (let i = 1; i <= totalPages; i++) {
    const start = performance.now();
    
    try {
      const response = await api.get(`${endpoint}?page=${i}&limit=${pageSize}`);
      const end = performance.now();
      
      results.push({
        page: i,
        status: 'success',
        itemCount: response.data.items.length,
        duration: end - start,
        hasNextPage: i < totalPages,
      });
    } catch (error) {
      const end = performance.now();
      
      results.push({
        page: i,
        status: 'error',
        error: error.message,
        duration: end - start,
      });
    }
  }
  
  return {
    averageRequestTime: results.reduce((sum, result) => sum + result.duration, 0) / results.length,
    successRate: results.filter(result => result.status === 'success').length / results.length,
    results,
  };
};

// Test parallel requests for stress testing
export const testParallelRequests = async (endpoint: string, concurrentRequests: number) => {
  const start = performance.now();
  
  const promises = Array(concurrentRequests)
    .fill(0)
    .map((_, index) => api.get(`${endpoint}?${index}`));
  
  try {
    const results = await Promise.allSettled(promises);
    const end = performance.now();
    
    return {
      totalDuration: end - start,
      successRate: results.filter(result => result.status === 'fulfilled').length / concurrentRequests,
      results,
    };
  } catch (error) {
    const end = performance.now();
    
    return {
      totalDuration: end - start,
      successRate: 0,
      error: error.message,
    };
  }
};