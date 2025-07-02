import { get, post, put, patch, del } from '../lib/api';

/**
 * Creates a CRUD service for a specific API resource
 * @param resourcePath The base path for the resource (e.g., 'users')
 */
export function createCrudService<T>(resourcePath: string) {
  return {
    /**
     * Get all resources with optional filters
     */
    getAll: async (params?: Record<string, any>) => {
      return get<{ items: T[], meta: { totalItems: number, page: number, limit: number } }>(
        `/${resourcePath}`, 
        { params }
      );
    },
    
    /**
     * Get a single resource by ID
     */
    getById: async (id: string) => {
      return get<T>(`/${resourcePath}/${id}`);
    },
    
    /**
     * Create a new resource
     */
    create: async (data: Partial<T>) => {
      return post<T>(`/${resourcePath}`, data);
    },
    
    /**
     * Update an existing resource
     */
    update: async (id: string, data: Partial<T>) => {
      return put<T>(`/${resourcePath}/${id}`, data);
    },
    
    /**
     * Partially update an existing resource
     */
    patch: async (id: string, data: Partial<T>) => {
      return patch<T>(`/${resourcePath}/${id}`, data);
    },
    
    /**
     * Delete a resource
     */
    remove: async (id: string) => {
      return del<{ success: boolean }>(`/${resourcePath}/${id}`);
    },
    
    /**
     * Custom action on a resource
     */
    customAction: async (id: string, action: string, data?: any) => {
      return post<any>(`/${resourcePath}/${id}/${action}`, data);
    }
  };
}