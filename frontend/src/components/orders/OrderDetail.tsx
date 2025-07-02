// src/components/orders/OrderDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import orderService from '../../services/orders.service';
import { Order, OrderStatus } from '../../types/order';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/user';
import RoleBasedContent from '../common/RoleBasedContent';
import OrderStatusBadge from './OrderStatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getOrder(id);
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus, notes?: string) => {
    if (!id || !order) return;
    
    try {
      setStatusChangeLoading(true);
      await orderService.updateOrderStatus(id, newStatus, notes);
      fetchOrderDetails(); // Refresh the order data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setStatusChangeLoading(false);
    }
  };

  const handleCancelOrder = async (reason: string) => {
    if (!id || !order) return;
    
    try {
      setStatusChangeLoading(true);
      await orderService.cancelOrder(id, reason);
      fetchOrderDetails(); // Refresh the order data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setStatusChangeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
          <button 
            className="mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            onClick={fetchOrderDetails}
          >
            Try Again
          </button>
        </div>
        <div className="mt-4">
          <button 
            className="text-blue-600 hover:text-blue-800" 
            onClick={() => navigate(-1)}
          >
            &larr; Back
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Not Found!</strong>
          <span className="block sm:inline"> Order not found or you don't have permission to view it.</span>
        </div>
        <div className="mt-4">
          <button 
            className="text-blue-600 hover:text-blue-800" 
            onClick={() => navigate('/orders')}
          >
            &larr; Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button 
          className="text-blue-600 hover:text-blue-800" 
          onClick={() => navigate(-1)}
        >
          &larr; Back
        </button>
      </div>

      {/* Order Header */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Order #{order.id}</h1>
            <p className="text-gray-500 mt-1">Created on {formatDate(order.createdAt)}</p>
          </div>
          <OrderStatusBadge status={order.status} large />
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Order Info */}
        <div className="col-span-2 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Order Details</h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Description</h3>
            <p className="text-gray-700">{order.description || 'No description provided'}</p>
          </div>

          {order.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Notes</h3>
              <p className="text-gray-700">{order.notes}</p>
            </div>
          )}
          
          {order.deliveryDate && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Delivery Date</h3>
              <p className="text-gray-700">{formatDate(order.deliveryDate)}</p>
            </div>
          )}

          <div className="border-t pt-4 mt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Total</h3>
              <span className="text-xl font-semibold">{formatCurrency(order.price)}</span>
            </div>
          </div>
        </div>

        {/* Sidebar - Client Info & Actions */}
        <div className="space-y-6">
          {/* Client Info */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Client Information</h2>
            <p><strong>Name:</strong> {order.clientName || 'N/A'}</p>
            <p><strong>ID:</strong> {order.clientId}</p>
          </div>

          {/* Status Actions */}
          <RoleBasedContent roles={[UserRole.ADMIN, UserRole.TAILOR]}>
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              
              <div className="space-y-3">
                {order.status === OrderStatus.PENDING && (
                  <button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                    onClick={() => handleStatusChange(OrderStatus.PROCESSING)}
                    disabled={statusChangeLoading}
                  >
                    {statusChangeLoading ? 'Processing...' : 'Start Processing'}
                  </button>
                )}
                
                {order.status === OrderStatus.PROCESSING && (
                  <button
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
                    onClick={() => handleStatusChange(OrderStatus.COMPLETED)}
                    disabled={statusChangeLoading}
                  >
                    {statusChangeLoading ? 'Completing...' : 'Mark Completed'}
                  </button>
                )}
                
                {(order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING) && (
                  <button
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
                    onClick={() => {
                      const reason = window.prompt('Please provide a reason for cancellation:');
                      if (reason) handleCancelOrder(reason);
                    }}
                    disabled={statusChangeLoading}
                  >
                    {statusChangeLoading ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
                
                <Link
                  to={`/orders/${order.id}/edit`}
                  className="block w-full bg-gray-200 hover:bg-gray-300 text-center py-2 px-4 rounded"
                >
                  Edit Order
                </Link>
              </div>
            </div>
          </RoleBasedContent>
        </div>
      </div>

      {/* Order History */}
      <div className="bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Order History</h2>
        
        {order.metadata?.statusHistory ? (
          <div className="space-y-4">
            {order.metadata.statusHistory.map((event, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                <p className="text-sm text-gray-500">{formatDate(event.date)}</p>
                <p className="font-medium">Status changed to <OrderStatusBadge status={event.status} /></p>
                {event.notes && <p className="text-gray-700 mt-1">{event.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No history available</p>
        )}
      </div>
    </div>
  );
};

export default OrderDetail;