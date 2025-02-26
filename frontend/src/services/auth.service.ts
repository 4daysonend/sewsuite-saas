// sewsuite-saas\frontend\src\services\auth.service.ts
import api from './api.service';
import { User } from '../types/user';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthResponse {
  access_token: string;
  user: User;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      
      // Store tokens and user info
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('userId', response.data.user.id);
      
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(data: RegisterData): Promise<User> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      
      // Store tokens and user info
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('userId', response.data.user.id);
      
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async googleLogin(token: string): Promise<User> {
    try {
      const response = await api.post<AuthResponse>('/auth/google', { token });
      
      // Store tokens and user info
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('userId', response.data.user.id);
      
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = '/login';
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
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