// src/components/account/UserProfile.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import userService from '../../services/user.service';
import { User, UserRole } from '../../types/user';
import orderService from '../../services/orders.service';
import RoleBasedContent from '../common/RoleBasedContent';
import { formatDate } from '../../utils/formatters';

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const userData = await userService.getUser(id);
      setUser(userData);

      // Once we have user data, fetch their orders if applicable
      if (userData.role === UserRole.CLIENT || userData.role === UserRole.TAILOR) {
        fetchUserOrders(userData.id, userData.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserOrders = async (userId: string, role: UserRole) => {
    try {
      setOrdersLoading(true);
      const params = role === UserRole.CLIENT 
        ? { clientId: userId, limit: 5 } 
        : { tailorId: userId, limit: 5 };
      
      const response = await orderService.getOrders(params);
      setOrders(response.items);
    } catch (err) {
      console.error('Failed to load user orders:', err);
      // We don't set the main error state here as this is secondary data
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleToggleUserStatus = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await userService.updateProfile(user.id, { isActive: !user.isActive });
      fetchUserData(); // Refresh user data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
          <button 
            className="mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            onClick={fetchUserData}
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Not Found!</strong>
          <span className="block sm:inline"> User not found or you don't have permission to view this profile.</span>
        </div>
        <div className="mt-4">
          <button 
            className="text-blue-600 hover:text-blue-800" 
            onClick={() => navigate('/admin/users')}
          >
            &larr; Back to Users
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

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* User Header */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div>
              <h1 className="text-2xl font-bold">
                {user.firstName} {user.lastName}
                {!user.isActive && <span className="ml-2 text-red-200">(Inactive)</span>}
              </h1>
              <p className="mt-1">{user.email}</p>
            </div>
            <div className="mt-4 md:mt-0">
              <span className="inline-block bg-blue-500 rounded-full px-3 py-1 text-sm font-semibold">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">User Information</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500">User ID:</span>
                  <p className="font-medium">{user.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email Verified:</span>
                  <p className="font-medium">{user.emailVerified ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Phone Number:</span>
                  <p className="font-medium">{user.phoneNumber || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Member Since:</span>
                  <p className="font-medium">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Additional Details</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500">Last Login:</span>
                  <p className="font-medium">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Address:</span>
                  <p className="font-medium">{user.address || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <p className="font-medium">
                    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Actions */}
          <RoleBasedContent roles={UserRole.ADMIN}>
            <div className="mt-8 pt-6 border-t">
              <h2 className="text-xl font-semibold mb-4">Admin Actions</h2>
              <div className="flex flex-wrap gap-4">
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                >
                  Edit User
                </button>
                <button 
                  className={`${user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded`}
                  onClick={handleToggleUserStatus}
                >
                  {user.isActive ? 'Deactivate User' : 'Activate User'}
                </button>
                {!user.emailVerified && (
                  <button 
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
                    onClick={async () => {
                      try {
                        // Implement verification resend functionality
                        await userService.resendVerification(user.id);
                        alert('Verification email sent');
                      } catch (err) {
                        alert('Failed to send verification email');
                      }
                    }}
                  >
                    Resend Verification Email
                  </button>
                )}
              </div>
            </div>
          </RoleBasedContent>
          
          {/* User Orders (if applicable) */}
          {(user.role === UserRole.CLIENT || user.role === UserRole.TAILOR) && (
            <div className="mt-8 pt-6 border-t">
              <h2 className="text-xl font-semibold mb-4">
                {user.role === UserRole.CLIENT ? 'Recent Orders' : 'Recent Projects'}
              </h2>
              
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {order.id.slice(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              order.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            <button 
                              className="hover:text-blue-900"
                              onClick={() => navigate(`/orders/${order.id}`)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No orders found for this user.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;