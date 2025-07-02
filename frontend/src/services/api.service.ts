// sewsuite-saas\frontend\src\services\api.service.ts
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config: AxiosRequestConfig): AxiosRequestConfig => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor - Handle token refresh
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // If error is 401 and we're not already refreshing
    if (error.response?.status === 401 && !isRefreshing) {
      // If we have a refresh token, try to use it
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken && !originalRequest.url?.includes('/auth/refresh')) {
        if (!isRefreshing) {
          isRefreshing = true;
          
          try {
            // Try to refresh the token
            const response = await axios.post(
              `${baseURL}/auth/refresh`,
              { refreshToken },
              { withCredentials: true }
            );
            
            const { access_token } = response.data;
            localStorage.setItem('token', access_token);
            
            // Notify all subscribers about the new token
            onRefreshed(access_token);
            isRefreshing = false;
            
            // Retry original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            
            // If refresh fails, clear auth data and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userId');
            window.location.href = '/login';
            
            return Promise.reject(refreshError);
          }
        } else {
          // If we're already refreshing, wait for the new token
          return new Promise((resolve) => {
            subscribeTokenRefresh((token: string) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(axios(originalRequest));
            });
          });
        }
      } else {
        // No refresh token or refresh endpoint - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;