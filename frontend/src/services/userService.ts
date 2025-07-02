// src/services/userService.ts
import api, { handleApiError } from '../lib/api';
import { User, UserRole } from '../types/user';

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
  // Get user by ID
  async getUser(id: string): Promise<User> {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get current user (the logged in user)
  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Query users with filters (admin only)
  async queryUsers(params: QueryUsersParams): Promise<{ users: User[]; total: number }> {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Create a new user (admin only)
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update user profile
  async updateProfile(id: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update user password
  async updatePassword(id: string, passwordData: UpdatePasswordRequest): Promise<void> {
    try {
      await api.patch(`/users/${id}/password`, passwordData);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update user email
  async updateEmail(id: string, emailData: UpdateEmailRequest): Promise<User> {
    try {
      const response = await api.patch(`/users/${id}/email`, emailData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update user preferences
  async updatePreferences(id: string, preferences: any): Promise<User> {
    try {
      const response = await api.patch(`/users/${id}/preferences`, preferences);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get user storage quota
  async getStorageQuota(id: string): Promise<any> {
    try {
      const response = await api.get(`/users/${id}/quota`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Delete a user (admin only)
  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`/users/${id}`);
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

// Create and export a singleton instance
const userService = new UserService();
export default userService;

// Mock implementation for testing and development
export const mockUserService = {
  // Mock data
  mockUsers: Array.from({ length: 50 }, (_, i) => ({
    id: `user-${i + 1}`,
    email: `user${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    fullName: `First${i + 1} Last${i + 1}`,
    role: i % 10 === 0 ? UserRole.ADMIN : i % 3 === 0 ? UserRole.TAILOR : UserRole.CLIENT,
    isActive: i % 7 !== 0,
    isVerified: i % 5 !== 0,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
    updatedAt: new Date(Date.now() - Math.floor(Math.random() * 5000000000)).toISOString(),
  })),

  // Simulated network delay
  async simulateDelay(min = 200, max = 600): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  },

  // Mock implementations with same signatures
  async getUser(id: string): Promise<User> {
    await this.simulateDelay();
    const user = this.mockUsers.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    return user as User;
  },

  async getCurrentUser(): Promise<User> {
    await this.simulateDelay();
    return this.mockUsers.find(u => u.role === UserRole.ADMIN) as User;
  },

  async queryUsers(params: QueryUsersParams): Promise<{ users: User[]; total: number }> {
    await this.simulateDelay();
    let filteredUsers = [...this.mockUsers];

    if (params.searchTerm) {
      const searchTerm = params.searchTerm.toLowerCase();
      filteredUsers = filteredUsers.filter(
        u => 
          u.email.toLowerCase().includes(searchTerm) ||
          u.firstName?.toLowerCase().includes(searchTerm) ||
          u.lastName?.toLowerCase().includes(searchTerm) ||
          u.fullName?.toLowerCase().includes(searchTerm)
      );
    }

    if (params.role) {
      filteredUsers = filteredUsers.filter(u => u.role === params.role);
    }

    if (params.isActive !== undefined) {
      filteredUsers = filteredUsers.filter(u => u.isActive === params.isActive);
    }

    if (params.isVerified !== undefined) {
      filteredUsers = filteredUsers.filter(u => u.isVerified === params.isVerified);
    }

    // Apply sorting
    if (params.sortBy) {
      filteredUsers.sort((a: any, b: any) => {
        const aVal = a[params.sortBy!];
        const bVal = b[params.sortBy!];
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return params.sortOrder === 'ASC' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        
        return params.sortOrder === 'ASC' ? aVal - bVal : bVal - aVal;
      });
    }

    // Get total before pagination
    const total = filteredUsers.length;

    // Apply pagination
    const page = params.page || 1;
    const limit = params.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;

    filteredUsers = filteredUsers.slice(start, end);

    return {
      users: filteredUsers as User[],
      total,
    };
  },

  // Implement remaining methods to match the real service
  async createUser(userData: CreateUserRequest): Promise<User> {
    await this.simulateDelay();
    const newUser = {
      id: `user-${this.mockUsers.length + 1}`,
      email: userData.email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      role: userData.role || UserRole.CLIENT,
      isActive: true,
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mockUsers.push(newUser);
    return newUser as User;
  },

  async updateProfile(id: string, userData: UpdateUserRequest): Promise<User> {
    await this.simulateDelay();
    const index = this.mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    const updatedUser = {
      ...this.mockUsers[index],
      ...userData,
      fullName: `${userData.firstName || this.mockUsers[index].firstName || ''} ${userData.lastName || this.mockUsers[index].lastName || ''}`.trim(),
      updatedAt: new Date().toISOString()
    };
    
    this.mockUsers[index] = updatedUser;
    return updatedUser as User;
  },

  async updatePassword(): Promise<void> {
    await this.simulateDelay();
    // No-op for mock implementation
  },

  async updateEmail(id: string, emailData: UpdateEmailRequest): Promise<User> {
    await this.simulateDelay();
    const index = this.mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    this.mockUsers[index].email = emailData.newEmail;
    this.mockUsers[index].updatedAt = new Date().toISOString();
    
    return this.mockUsers[index] as User;
  },

  async updatePreferences(id: string, preferences: any): Promise<User> {
    await this.simulateDelay();
    const index = this.mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    this.mockUsers[index].preferences = preferences;
    this.mockUsers[index].updatedAt = new Date().toISOString();
    
    return this.mockUsers[index] as User;
  },

  async getStorageQuota(): Promise<any> {
    await this.simulateDelay();
    return {
      total: 1024 * 1024 * 1024, // 1GB
      used: 1024 * 1024 * 350,   // 350MB
      available: 1024 * 1024 * 674 // 674MB
    };
  },

  async deleteUser(id: string): Promise<void> {
    await this.simulateDelay();
    const index = this.mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    this.mockUsers.splice(index, 1);
  }
};