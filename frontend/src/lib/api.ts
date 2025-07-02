// src/lib/api.ts
import axios, { AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { getSecureCookie, removeSecureCookie } from '../utils/cookies';
import { handleError, ErrorType } from '../utils/errorHandler';

// Create configurable API client
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds
});

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// Check if an endpoint requires authentication
const requiresAuth = (url: string): boolean => {
  return !PUBLIC_ENDPOINTS.some(endpoint => url.startsWith(endpoint));
};

// Request interceptor for auth headers
api.interceptors.request.use(
  (config) => {
    const token = getSecureCookie('token');
    
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
      
      // Add CSRF protection for mutation requests
      if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
        const csrfToken = localStorage.getItem('csrf_token');
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
    } else if (requiresAuth(config.url || '')) {
      // Redirect to login or return error for API calls
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const appError = handleError(error);
    
    // Handle authentication errors by redirecting to login
    if (appError.type === ErrorType.AUTHENTICATION) {
      removeSecureCookie('token');
      removeSecureCookie('refreshToken');
      
      // Store original URL to redirect back after login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    
    return Promise.reject(appError);
  }
);

// Type-safe request helpers
export const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.get<T>(url, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const post = async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.post<T>(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const put = async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.put<T>(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const patch = async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.patch<T>(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.delete<T>(url, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;