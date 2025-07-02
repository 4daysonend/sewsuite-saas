import { GetServerSideProps } from 'next';
import { SWRConfig } from 'swr';
import OrdersList from '../../components/orders/OrdersList';
import { get } from '../../lib/api';

// Server-side props to prefetch data
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Get page from query or default to 1
    const page = Number(context.query.page) || 1;
    const limit = 10;
    
    // Fetch data on server
    const ordersData = await get(`/orders?page=${page}&limit=${limit}`);
    
    // Return as props
    return {
      props: {
        fallback: {
          '/orders': ordersData,
        },
      },
    };
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    
    // Return fallback data
    return {
      props: {
        fallback: {
          '/orders': { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } },
        },
      },
    };
  }
};

// Page component with SWR hydration
export default function OrdersPage({ fallback }) {
  return (
    <SWRConfig value={{ fallback }}>
      <OrdersList />
    </SWRConfig>
  );
}