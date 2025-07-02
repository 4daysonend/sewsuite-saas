import useSWR, { SWRConfiguration, SWRResponse } from 'swr';
import { get } from '../lib/api';

interface FetcherOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

interface UseDataOptions<Data = any> extends SWRConfiguration<Data> {
  initialData?: Data;
  fetcherOptions?: FetcherOptions;
}

/**
 * Custom hook for data fetching with SWR and SSR support
 */
export function useData<Data = any>(
  key: string | null,
  options: UseDataOptions<Data> = {}
): SWRResponse<Data, Error> & {
  isLoading: boolean;
} {
  const {
    initialData,
    fetcherOptions,
    ...swrOptions
  } = options;

  // Create a custom fetcher that includes our options
  const fetcher = async (url: string) => {
    return get<Data>(url, {
      headers: fetcherOptions?.headers,
      params: fetcherOptions?.params,
    });
  };

  const swr = useSWR<Data, Error>(
    key,
    fetcher,
    {
      fallbackData: initialData,
      ...swrOptions,
    }
  );

  return {
    ...swr,
    isLoading: !swr.error && !swr.data,
  };
}