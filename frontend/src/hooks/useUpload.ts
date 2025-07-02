import { useState, useCallback } from 'react';
import uploadService, { mockUploadService, UploadMetadata, UploadQueryParams } from '../services/uploadService';
import { FileUpload } from '../types/upload';
import { useMockServices } from '../utils/environment';

// Hook for file uploads
export function useUpload() {
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  const service = useMockServices ? mockUploadService : uploadService;

  const uploadFile = useCallback(async (file: File, metadata: UploadMetadata): Promise<FileUpload | null> => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);
      
      // For mock service, simulate progress
      if (useMockServices) {
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            const next = prev + Math.random() * 20;
            return next > 95 ? 95 : next;
          });
        }, 300);
        
        const result = await service.uploadFile(file, metadata);
        
        clearInterval(progressInterval);
        setProgress(100);
        return result;
      } else {
        // For real service, would ideally have progress tracking
        const result = await service.uploadFile(file, metadata);
        setProgress(100);
        return result;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setError(message);
      return null;
    } finally {
      setUploading(false);
    }
  }, [service]);

  return {
    uploadFile,
    uploading,
    progress,
    error,
    resetUpload: () => {
      setUploading(false);
      setProgress(0);
      setError(null);
    }
  };
}

// Hook for fetching files
export function useFiles(params: UploadQueryParams = {}) {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const service = useMockServices ? mockUploadService : uploadService;

  const fetchFiles = useCallback(async (queryParams: UploadQueryParams = params) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.getFiles(queryParams);
      setFiles(result.items);
      setTotal(result.total);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load files';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [params, service]);

  const deleteFile = useCallback(async (id: string) => {
    try {
      await service.deleteFile(id);
      // Remove from local state after deletion
      setFiles(prevFiles => prevFiles.filter(file => file.id !== id));
      setTotal(prev => prev - 1);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      setError(message);
      return false;
    }
  }, [service]);

  // Initial fetch
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    total,
    loading,
    error,
    fetchFiles,
    deleteFile
  };
}