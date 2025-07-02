import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { get } from '../lib/api';
import orderService, { mockOrderService, OrderQueryParams } from '../services/orderService';
import { Order } from '../types/order';
import { useMockServices } from '../utils/environment';

// Fetcher function that uses our API utility
const fetcher = (url: string) => get(url);

export function useOrders(params: OrderQueryParams = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const service = useMockServices ? mockOrderService : orderService;

  const queryString = params 
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';
  
  const { data, error: swrError, mutate } = useSWR(`/orders${queryString}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 30000, // refresh every 30 seconds
    dedupingInterval: 2000, // dedupe requests within 2 seconds
  });

  const fetchOrders = useCallback(async (queryParams: OrderQueryParams = params) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.getOrders(queryParams);
      setOrders(result.items);
      setTotal(result.total);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [params, service]);

  useEffect(() => {
    if (!swrError && data) {
      setOrders(data.items);
      setTotal(data.meta.totalItems);
    }
  }, [data, swrError]);

  return {
    orders,
    total,
    loading: isLoading,
    error: error || swrError,
    fetchOrders,
    mutate
  };
}

export function useOrder(orderId: string | null) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(!!orderId);
  const [error, setError] = useState<string | null>(null);
  
  const service = useMockServices ? mockOrderService : orderService;

  const fetchOrder = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await service.getOrder(id);
      setOrder(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load order details';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  return {
    order,
    loading,
    error,
    refreshOrder: orderId ? () => fetchOrder(orderId) : () => {}
  };
}