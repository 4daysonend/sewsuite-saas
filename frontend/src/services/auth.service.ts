// sewsuite-saas\frontend\src\services\auth.service.ts
import api from './api.service';
import { User } from '../types/user';

interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: User;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      
      // Store tokens and user info
      this.setAuthData(response.data);
      
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(data: RegisterData): Promise<User> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      
      // Store tokens and user info
      this.setAuthData(response.data);
      
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async refreshToken(): Promise<User> {
    try {
      const response = await api.post<AuthResponse>('/auth/refresh');
      
      // Update stored tokens and user info
      this.setAuthData(response.data);
      
      return response.data.user;
    } catch (error) {
      this.clearAuthData();
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint to invalidate tokens
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuthData();
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await api.post('/auth/forgot-password', { email });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    try {
      await api.post('/auth/reset-password', { token, password });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Handle OAuth callbacks from the server
  handleOAuthCallback(): boolean {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      localStorage.setItem('token', token);
      return true;
    }
    return false;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUserId(): string | null {
    return localStorage.getItem('userId');
  }

  private setAuthData(data: AuthResponse): void {
    localStorage.setItem('token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refreshToken', data.refresh_token);
    }
    localStorage.setItem('userId', data.user.id);
  }

  private clearAuthData(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
  }

  private handleError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 400 && data.message) {
        return new Error(data.message);
      }
      return new Error(`Authentication failed: ${status}`);
    }
    return new Error('Authentication failed. Please try again.');
  }
}

export default new AuthService();