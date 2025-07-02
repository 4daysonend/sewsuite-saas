/**
 * Environment detection utilities
 */

// Environment detection
export const isProd = process.env.NODE_ENV === 'production';
export const isDev = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';

// Feature flags
export const useMockServices = process.env.REACT_APP_USE_MOCK_SERVICES === 'true' || isDev;

// API configuration
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// For development display
export function getEnvironmentInfo() {
  return {
    environment: isProd ? 'production' : isDev ? 'development' : 'test',
    mockServices: useMockServices,
    apiUrl: API_URL
  };
}