// src/services/userService.ts
import axios from 'axios';
import { User } from '../types/user';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Types for requests
export interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  preferences?: any;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  preferences?: any;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateEmailRequest {
  newEmail: string;
  currentPassword: string;
}

export interface QueryUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

class UserService {
  private getAuthHeader() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  // Get user by ID
  async getUser(id: string): Promise<User> {
    try {
      const response = await axios.get(`${API_URL}/users/${id}`, this.getAuthHeader());
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get current user (the logged in user)
  async getCurrentUser(): Promise<User> {
    try {
      const response = await axios.get(`${API_URL}/users/me`, this.getAuthHeader());
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Query users with filters (admin only)
  async queryUsers(params: QueryUsersParams): Promise<{ users: User[]; total: number }> {
    try {
      const response = await axios.get(`${API_URL}/users`, {
        ...this.getAuthHeader(),
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create a new user (admin only)
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await axios.post(`${API_URL}/users`, userData, this.getAuthHeader());
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update user profile
  async updateProfile(id: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const response = await axios.put(`${API_URL}/users/${id}`, userData, this.getAuthHeader());
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update user password
  async updatePassword(id: string, passwordData: UpdatePasswordRequest): Promise<void> {
    try {
      await axios.patch(
        `${API_URL}/users/${id}/password`,
        passwordData,
        this.getAuthHeader()
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update user email
  async updateEmail(id: string, emailData: UpdateEmailRequest): Promise<User> {
    try {
      const response = await axios.patch(
        `${API_URL}/users/${id}/email`,
        emailData,
        this.getAuthHeader()
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update user preferences
  async updatePreferences(id: string, preferences: any): Promise<User> {
    try {
      const response = await axios.patch(
        `${API_URL}/users/${id}/preferences`,
        preferences,
        this.getAuthHeader()
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get user storage quota
  async getStorageQuota(id: string): Promise<any> {
    try {
      const response = await axios.get(
        `${API_URL}/users/${id}/quota`,
        this.getAuthHeader()
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete a user (admin only)
  async deleteUser(id: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/users/${id}`, this.getAuthHeader());
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper function to handle errors
  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      if (status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return new Error(data.message || `Server error: ${status}`);
    } else if (error.request) {
      // Request made but no response received
      return new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      return new Error(error.message || 'An unknown error occurred');
    }
  }
}

export default new UserService();