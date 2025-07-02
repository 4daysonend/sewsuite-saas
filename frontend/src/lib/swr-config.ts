import { SWRConfig } from 'swr';
import { get } from './api';

export const swrConfig = {
  fetcher: (url: string) => get(url),
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 0, // Set to 0 to disable auto-refresh
  errorRetryCount: 3,
  suspense: false,
  onError: (error: any, key: string) => {
    console.error(`SWR Error fetching ${key}:`, error);
  }
};

export const SWRProvider: React.FC<{ children: React.ReactNode, fallback?: any }> = ({ 
  children, 
  fallback 
}) => {
  return (
    <SWRConfig value={{ ...swrConfig, fallback }}>
      {children}
    </SWRConfig>
  );
};