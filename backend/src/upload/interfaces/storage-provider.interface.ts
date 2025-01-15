export interface StorageProvider {
  uploadFile(file: Buffer, path: string, options?: any): Promise<string>;
  downloadFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
  moveFile(sourcePath: string, destinationPath: string): Promise<void>;
}
