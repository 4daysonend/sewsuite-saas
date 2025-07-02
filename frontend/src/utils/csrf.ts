import { get } from '../lib/api';

let csrfToken: string | null = null;

export const fetchCsrfToken = async (): Promise<string> => {
  try {
    const response = await get<{ token: string }>('/auth/csrf-token');
    csrfToken = response.token;
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    throw error;
  }
};

export const getCsrfToken = (): string | null => csrfToken;