import React from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorAlert from '../common/ErrorAlert';
import { formatCurrency } from '../../utils/formatters';
import RoleBasedContent from '../common/RoleBasedContent';
import { UserRole } from '../../types/user';
import { usePermissions } from '../../hooks/usePermissions';

const Dashboard: React.FC = () => {
  const { dashboardData, isLoading, isError, error } = useDashboard();
  const { hasPermission, PERMISSIONS } = usePermissions();
  
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorAlert message={error?.message || 'Failed to load dashboard data'} />;
  
  const { stats, recentOrders, recentUsers } = dashboardData;
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats cards - different cards for different roles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Everyone sees the orders stat */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-gray-500 text-sm font-medium">Total Orders</div>
          <div className="text-3xl font-bold">{stats.orderCount}</div>
        </div>
        
        {/* Only admins and up see user stats */}
        <RoleBasedContent requiredRoles={[UserRole.ADMIN, UserRole.SUPERADMIN]}>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-gray-500 text-sm font-medium">Total Users</div>
            <div className="text-3xl font-bold">{stats.userCount}</div>
          </div>
        </RoleBasedContent>
        
        {/* Only those with revenue view permission see financial data */}
        {hasPermission(PERMISSIONS.VIEW_ANALYTICS) && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-gray-500 text-sm font-medium">Revenue (Monthly)</div>
            <div className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
          </div>
        )}
        
        {/* All authenticated users see projects */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-gray-500 text-sm font-medium">Active Projects</div>
          <div className="text-3xl font-bold">{stats.activeProjects}</div>
        </div>
      </div>
      
      {/* Recent Orders - visible to all authenticated users */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Recent Orders</h2>
          <a href="/orders" className="text-blue-500 hover:underline">View all</a>
        </div>
        {/* Order table implementation */}
        {recentOrders.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.map(order => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{order.id.substring(0, 8)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent orders found</p>
        )}
      </div>
      
      {/* Recent Users - only visible to admins */}
      <RoleBasedContent 
        requiredRoles={[UserRole.ADMIN, UserRole.SUPERADMIN]} 
        fallback={null}
      >
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Recent Users</h2>
            <a href="/admin/users" className="text-blue-500 hover:underline">View all</a>
          </div>
          {/* User table implementation */}
          {recentUsers.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentUsers.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.status === 'active' ? 'bg-green-100 text-green-800' : 
                        user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent users found</p>
          )}
        </div>
      </RoleBasedContent>
    </div>
  );
};

export default Dashboard;