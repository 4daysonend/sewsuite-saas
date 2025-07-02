// src/components/files/FilesList.tsx
import React, { useState, useEffect } from 'react';
import uploadService from '../../services/upload.service';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatBytes } from '../../utils/formatters';

interface FileItem {
  id: string;
  filename: string;
  category: string;
  size: number;
  uploadDate: string;
  url?: string;
  thumbnailUrl?: string;
  orderId?: string;
  metadata?: Record<string, any>;
}

const FilesList: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    orderId: '',
    searchTerm: '',
  });
  const [quota, setQuota] = useState<{ total: number; used: number; percentage: number } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchFiles();
    fetchQuota();
  }, [filters]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await uploadService.getUserFiles(filters);
      setFiles(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const quotaData = await uploadService.getStorageQuota();
      setQuota({
        total: quotaData.total,
        used: quotaData.used,
        percentage: (quotaData.used / quotaData.total) * 100,
      });
    } catch (err) {
      console.error('Failed to fetch storage quota', err);
    }
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const category = prompt('Select a category for this file', 'document');
    if (!category) return;
    
    try {
      setUploadLoading(true);
      await uploadService.uploadFile(file, { category });
      fetchFiles(); // Refresh the files list
      fetchQuota(); // Update quota after upload
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this file? This cannot be undone.');
    if (!confirmed) return;
    
    try {
      await uploadService.deleteFile(fileId);
      setFiles(files.filter(file => file.id !== fileId));
      fetchQuota(); // Update quota after deletion
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const renderFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    }
    
    if (['pdf'].includes(extension)) {
      return <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
    }
    
    if (['doc', 'docx'].includes(extension)) {
      return <svg className="w-8 h-8 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    }
    
    return <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Files</h1>
      
      {/* Storage quota display */}
      {quota && (
        <div className="bg-white shadow-md rounded-lg p-4 mb-6">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">Storage Used</span>
            <span className="text-sm font-medium">
              {formatBytes(quota.used)} of {formatBytes(quota.total)} ({quota.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full">
            <div 
              className={`h-2 rounded-full ${
                quota.percentage < 70 ? 'bg-blue-500' : 
                quota.percentage < 90 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(quota.percentage, 100)}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* File upload and filters */}
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Search files..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
          <div>
            <select
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="document">Document</option>
              <option value="image">Image</option>
              <option value="pattern">Pattern</option>
              <option value="measurement">Measurement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              Upload File
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadLoading}
              />
            </label>
          </div>
        </div>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Upload loading indicator */}
      {uploadLoading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading file...
          </span>
        </div>
      )}

      {/* Files display */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.map((file) => (
            <div key={file.id} className="bg-white shadow-md rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 flex-grow">
                <div className="flex items-start">
                  {file.thumbnailUrl ? (
                    <img src={file.thumbnailUrl} alt={file.filename} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    renderFileIcon(file.filename)
                  )}
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-900 truncate" title={file.filename}>
                      {file.filename}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatBytes(file.size)} • Uploaded {formatDate(file.uploadDate)}
                    </p>
                    <div className="mt-1">
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {file.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 flex justify-between">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  View
                </a>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by uploading a file.
          </p>
          <div className="mt-6">
            <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadLoading}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesList;