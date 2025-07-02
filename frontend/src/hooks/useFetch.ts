import useSWR, { SWRConfiguration } from 'swr';
import { get } from '../lib/api';

// Global fetcher function
const fetcher = (url: string) => get(url);

// Generic fetch hook
export function useFetch<T>(url: string | null, options?: SWRConfiguration) {
  const { data, error, mutate, isValidating } = useSWR<T>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      ...options,
    }
  );
  
  return {
    data,
    isLoading: !error && !data,
    error,
    mutate,
    isValidating,
  };
}

// Example resource-specific hook
export function useOrders(page = 1, limit = 10) {
  const { data, isLoading, error, mutate } = useFetch(`/orders?page=${page}&limit=${limit}`);
  
  return {
    orders: data?.items || [],
    pagination: data?.meta || { page, limit, total: 0, totalPages: 0 },
    isLoading,
    error,
    mutate,
  };
}