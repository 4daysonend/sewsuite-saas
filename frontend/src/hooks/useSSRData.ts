import { useEffect, useState } from 'react';
import { get } from '../lib/api';

/**
 * Hook for fetching data during server-side rendering and client hydration
 * 
 * @param url API endpoint to fetch
 * @param initialData Optional data to use before fetch completes (useful for SSR)
 */
export function useSSRData<T>(url: string, initialData?: T) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!url) return;
      
      try {
        setIsLoading(true);
        const result = await get<T>(url);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    // If we already have data (from SSR), don't fetch immediately
    // but schedule a refresh for later
    if (initialData) {
      const timer = setTimeout(() => {
        fetchData();
      }, 5000); // Refresh after 5 seconds
      return () => clearTimeout(timer);
    } else {
      fetchData();
    }
  }, [url]);

  return { data, isLoading, error, refetch: () => get<T>(url).then(setData) };
}