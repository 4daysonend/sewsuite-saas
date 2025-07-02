/* eslint-disable @typescript-eslint/no-namespace */
import { Request } from 'express';

export interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}
export interface FileUploadResult {
  // The uploaded file entity
  entity?: File;

  // Alternative property name for the file entity
  file?: File;

  // Download URL for the uploaded file
  url?: string;

  // Status of the upload
  success: boolean;
}
