// src/components/orders/OrdersList.tsx
import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useDataFetching';
import { useAuth } from '../../contexts/AuthContext';
import OrdersTable from './OrdersTable';
import OrderFilters from './OrderFilters';
import OrdersPagination from './OrdersPagination';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

// This would be your Order type
interface Order {
  id: string;
  customerId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: any[];
  totalAmount: number;
  // ... other order properties
}

interface OrdersResponse {
  items: Order[];
  meta: {
    totalItems: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

// Make this available for SSR data prefetching
export const loadOrdersData = async (page = 1, filters = {}) => {
  try {
    // This would be called during SSR or can be used in loaders
    return await get<OrdersResponse>('/orders', {
      params: { page, ...filters }
    });
  } catch (error) {
    console.error('Failed to load orders:', error);
    return { 
      items: [], 
      meta: { totalItems: 0, itemsPerPage: 10, totalPages: 0, currentPage: 1 } 
    };
  }
};

interface OrdersListProps {
  initialData?: OrdersResponse;
}

const OrdersList: React.FC<OrdersListProps> = ({ initialData }) => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [filters, setFilters] = useState<Record<string, any>>({});
  
  // Construct the API URL with query parameters
  const apiUrl = `/orders?page=${page}&limit=${limit}&sortBy=${sortBy}&sortDir=${sortDir}${
    Object.entries(filters)
      .map(([key, value]) => `&${key}=${encodeURIComponent(String(value))}`)
      .join('')
  }`;

  // Fetch orders with SWR
  const { data, error, isLoading, mutate } = useData<OrdersResponse>(
    apiUrl,
    { 
      initialData,
      // Refresh every minute
      refreshInterval: 60000,
    }
  );

  // Handle filter changes
  const handleFilterChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  // For extra resilience, we can also fetch on mount
  useEffect(() => {
    // If we didn't get initialData from SSR, fetch it now
    if (!initialData) {
      mutate();
    }
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message="Failed to load orders. Please try again later." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Orders</h1>
        <button 
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => mutate()} // Manual refresh
        >
          Refresh
        </button>
      </div>
      
      {/* Order filters and sorting controls */}
      <div className="mb-4 flex justify-between items-center">
        <OrderFilters currentFilters={filters} onFilterChange={handleFilterChange} />
      </div>
      
      {/* Orders list */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {data?.items.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No orders found.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {data.items.map(order => (
              <OrderItem key={order.id} order={order} />
            ))}
          </ul>
        )}
      </div>
      
      {/* Pagination */}
      <div className="mt-6">
        <OrdersPagination
          currentPage={data?.meta.currentPage || 1}
          totalPages={data?.meta.totalPages || 1}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default OrdersList;