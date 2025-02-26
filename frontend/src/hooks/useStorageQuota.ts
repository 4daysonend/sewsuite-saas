// sewsuite-saas/frontend/src/hooks/useStorageQuota.ts
export default useStorageQuota;
import { useState, useEffect } from 'react';
import axios from 'axios';

interface StorageQuota {
  used: number;
  total: number;
  percentage: number;
  quotaByCategory?: Record<string, number>;
}

interface UseStorageQuotaResult {
  quota: StorageQuota | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  formatBytes: (bytes: number) => string;
}

export const useStorageQuota = (userId?: string): UseStorageQuotaResult => {
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // If no userId is provided, use the logged-in user's ID
      const id = userId || localStorage.getItem('userId');
      
      if (!id) {
        throw new Error('No user ID provided');
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get(`/api/users/${id}/quota`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setQuota(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching storage quota:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, [userId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return { quota, loading, error, refetch: fetchQuota, formatBytes };