import api, { handleApiError } from '../lib/api';
import { FileUpload } from '../types/upload';

export interface UploadQueryParams {
  category?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface UploadMetadata {
  category: string;
  description?: string;
  orderId?: string;
}

class UploadService {
  // Upload a file
  async uploadFile(file: File, metadata: UploadMetadata): Promise<FileUpload> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add metadata
      Object.keys(metadata).forEach(key => {
        if (metadata[key as keyof UploadMetadata] !== undefined) {
          formData.append(key, String(metadata[key as keyof UploadMetadata]));
        }
      });
      
      const response = await api.post('/uploads', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get all user's files with optional filtering
  async getFiles(params: UploadQueryParams = {}): Promise<{ items: FileUpload[]; total: number; page: number; limit: number }> {
    try {
      const response = await api.get('/uploads', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get a specific file by ID
  async getFile(id: string): Promise<FileUpload> {
    try {
      const response = await api.get(`/uploads/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get files for a specific order
  async getOrderFiles(orderId: string): Promise<FileUpload[]> {
    try {
      const response = await api.get(`/uploads/order/${orderId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Update file metadata
  async updateFile(id: string, metadata: Partial<UploadMetadata>): Promise<FileUpload> {
    try {
      const response = await api.patch(`/uploads/${id}`, metadata);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Delete a file
  async deleteFile(id: string): Promise<void> {
    try {
      await api.delete(`/uploads/${id}`);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // Get storage quota information
  async getStorageQuota(): Promise<{ used: number; total: number; available: number }> {
    try {
      const response = await api.get('/uploads/quota');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

const uploadService = new UploadService();
export default uploadService;

// Mock implementation for testing
export const mockUploadService = {
  // Mock files
  mockFiles: Array.from({ length: 20 }, (_, i) => ({
    id: `file-${i + 1}`,
    filename: `document-${i + 1}.${['pdf', 'jpg', 'png', 'doc'][i % 4]}`,
    originalName: `Original Document ${i + 1}.${['pdf', 'jpg', 'png', 'doc'][i % 4]}`,
    mimeType: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword'
    ][i % 4],
    size: Math.floor(Math.random() * 5000000) + 100000, // Random size between 100KB and 5MB
    url: `https://storage.example.com/files/document-${i + 1}.${['pdf', 'jpg', 'png', 'doc'][i % 4]}`,
    thumbnailUrl: [1, 2].includes(i % 4) ? 
      `https://storage.example.com/thumbnails/document-${i + 1}.jpg` : undefined,
    category: ['pattern', 'design', 'measurement', 'invoice'][i % 4],
    description: i % 2 === 0 ? `Description for document ${i + 1}` : undefined,
    orderId: i % 3 === 0 ? `order-${Math.floor(i / 3) + 1}` : undefined,
    userId: `user-${(i % 5) + 1}`,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    updatedAt: new Date(Date.now() - Math.floor(Math.random() * 15 * 24 * 60 * 60 * 1000)).toISOString()
  })),

  // Simulated network delay
  async simulateDelay(min = 300, max = 800): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  },

  // Mock implementation of service methods
  async getFiles(params: UploadQueryParams = {}): Promise<{ items: FileUpload[]; total: number; page: number; limit: number }> {
    await this.simulateDelay();
    let filteredFiles = [...this.mockFiles];
    
    if (params.category) {
      filteredFiles = filteredFiles.filter(file => file.category === params.category);
    }
    
    if (params.orderId) {
      filteredFiles = filteredFiles.filter(file => file.orderId === params.orderId);
    }
    
    // Apply date filters if present
    if (params.startDate) {
      const startDate = new Date(params.startDate).getTime();
      filteredFiles = filteredFiles.filter(file => new Date(file.createdAt).getTime() >= startDate);
    }
    
    if (params.endDate) {
      const endDate = new Date(params.endDate).getTime();
      filteredFiles = filteredFiles.filter(file => new Date(file.createdAt).getTime() <= endDate);
    }
    
    // Calculate total before pagination
    const total = filteredFiles.length;
    
    // Apply pagination
    const page = params.page || 1;
    const limit = params.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    filteredFiles = filteredFiles.slice(start, end);
    
    return {
      items: filteredFiles as FileUpload[],
      total,
      page,
      limit
    };
  },
  
  async getFile(id: string): Promise<FileUpload> {
    await this.simulateDelay();
    const file = this.mockFiles.find(f => f.id === id);
    if (!file) throw new Error('File not found');
    return file as FileUpload;
  },
  
  async getOrderFiles(orderId: string): Promise<FileUpload[]> {
    await this.simulateDelay();
    return this.mockFiles.filter(file => file.orderId === orderId) as FileUpload[];
  },
  
  async uploadFile(file: File, metadata: UploadMetadata): Promise<FileUpload> {
    await this.simulateDelay(1000, 2000); // Longer delay for upload simulation
    
    const id = `file-${this.mockFiles.length + 1}`;
    const extension = file.name.split('.').pop() || 'unknown';
    
    const newFile = {
      id,
      filename: `uploaded-${id}.${extension}`,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      url: `https://storage.example.com/files/uploaded-${id}.${extension}`,
      thumbnailUrl: file.type.startsWith('image/') ? 
        `https://storage.example.com/thumbnails/uploaded-${id}.jpg` : undefined,
      category: metadata.category,
      description: metadata.description,
      orderId: metadata.orderId,
      userId: 'user-1', // Current user
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.mockFiles.push(newFile);
    return newFile as FileUpload;
  },
  
  async updateFile(id: string, metadata: Partial<UploadMetadata>): Promise<FileUpload> {
    await this.simulateDelay();
    
    const fileIndex = this.mockFiles.findIndex(f => f.id === id);
    if (fileIndex === -1) throw new Error('File not found');
    
    this.mockFiles[fileIndex] = {
      ...this.mockFiles[fileIndex],
      ...metadata,
      updatedAt: new Date().toISOString()
    };
    
    return this.mockFiles[fileIndex] as FileUpload;
  },
  
  async deleteFile(id: string): Promise<void> {
    await this.simulateDelay();
    
    const fileIndex = this.mockFiles.findIndex(f => f.id === id);
    if (fileIndex === -1) throw new Error('File not found');
    
    this.mockFiles.splice(fileIndex, 1);
  },
  
  async getStorageQuota(): Promise<{ used: number; total: number; available: number }> {
    await this.simulateDelay();
    
    // Calculate total size of all mock files
    const usedBytes = this.mockFiles.reduce((sum, file) => sum + file.size, 0);
    const totalBytes = 1024 * 1024 * 1024 * 10; // 10 GB
    
    return {
      used: usedBytes,
      total: totalBytes,
      available: totalBytes - usedBytes
    };
  }
};