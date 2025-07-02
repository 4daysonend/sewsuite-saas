import useSWR from 'swr';
import { get } from '../lib/api';

const fetcher = (url: string) => get(url);

export function useDashboard() {
  const { data, error, mutate } = useSWR('/admin/dashboard', fetcher, {
    refreshInterval: 60000, // refresh every minute
  });

  return {
    dashboardData: data,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
    error
  };
}