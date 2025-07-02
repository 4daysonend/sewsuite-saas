export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  category: string;
  description?: string;
  orderId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileCategory {
  id: string;
  name: string;
  description?: string;
  allowedFileTypes: string[];
  maxFileSize: number;
}