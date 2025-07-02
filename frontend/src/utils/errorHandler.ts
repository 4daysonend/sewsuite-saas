import { AxiosError } from 'axios';

// Error types
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  NOT_FOUND = 'notFound',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}

// Error with contextual information
export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  validationErrors?: Record<string, string[]>;
  statusCode?: number;
}

// Convert any error to AppError format
export const handleError = (error: any): AppError => {
  // Network errors
  if (error?.isAxiosError && !error.response) {
    return {
      type: ErrorType.NETWORK,
      message: 'Unable to connect to the server. Please check your connection.',
      originalError: error,
    };
  }

  // Extract status code if available
  const statusCode = error?.response?.status || error?.statusCode;

  // Authentication errors
  if (statusCode === 401) {
    return {
      type: ErrorType.AUTHENTICATION,
      message: 'Your session has expired. Please sign in again.',
      originalError: error,
      statusCode,
    };
  }

  // Permission errors
  if (statusCode === 403) {
    return {
      type: ErrorType.PERMISSION,
      message: 'You do not have permission to perform this action.',
      originalError: error,
      statusCode,
    };
  }

  // Validation errors
  if (statusCode === 400 || statusCode === 422) {
    // Extract validation errors from response
    const validationErrors = error?.response?.data?.errors || error?.errors;
    
    return {
      type: ErrorType.VALIDATION,
      message: error?.response?.data?.message || 'Please check your information and try again.',
      validationErrors,
      originalError: error,
      statusCode,
    };
  }

  // Not found errors
  if (statusCode === 404) {
    return {
      type: ErrorType.NOT_FOUND,
      message: 'The requested resource was not found.',
      originalError: error,
      statusCode,
    };
  }

  // Server errors
  if (statusCode && statusCode >= 500) {
    return {
      type: ErrorType.SERVER,
      message: 'Something went wrong on our end. Please try again later.',
      originalError: error,
      statusCode,
    };
  }

  // Fallback for other errors
  return {
    type: ErrorType.UNKNOWN,
    message: error?.message || 'An unexpected error occurred.',
    originalError: error,
    statusCode,
  };
};

// Helper to extract user-friendly message
export const getUserFriendlyErrorMessage = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Cannot connect to the server. Please check your internet connection.';
    
    case ErrorType.AUTHENTICATION:
      return 'Please sign in to continue.';
    
    case ErrorType.PERMISSION:
      return 'You don\'t have permission to perform this action.';
    
    case ErrorType.VALIDATION:
      // Return first validation error or generic message
      if (error.validationErrors) {
        const firstField = Object.keys(error.validationErrors)[0];
        if (firstField) {
          return error.validationErrors[firstField][0] || error.message;
        }
      }
      return error.message;
    
    case ErrorType.NOT_FOUND:
      return 'The requested information could not be found.';
    
    case ErrorType.SERVER:
      return 'Our servers are experiencing issues. Please try again later.';
    
    default:
      return error.message;
  }
};