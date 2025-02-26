// src/components/user/UserManagementDashboard.tsx
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types/user';
import userService, { QueryUsersParams } from '../../services/userService';

const UserManagementDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  
  // Filters
  const [filters, setFilters] = useState<QueryUsersParams>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC'
  });

  useEffect(() => {
    fetchUsers();
  }, [page, limit, filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams: QueryUsersParams = {
        ...filters,
        page,
        limit
      };
      
      const { users: fetchedUsers, total } = await userService.queryUsers(queryParams);
      
      setUsers(fetchedUsers);
      setTotalUsers(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(1); // Reset to first page when filters change
  };

  const handleRoleFilter = (role: UserRole | '') => {
    setFilters(prev => ({
      ...prev,
      role: role || undefined
    }));
    setPage(1);
  };

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({
      ...prev,
      searchTerm: searchTerm || undefined
    }));
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when limit changes
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(totalUsers / limit);
    
    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
          <span className="font-medium">{Math.min(page * limit, totalUsers)}</span> of{' '}
          <span className="font-medium">{totalUsers}</span> users
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className={`px-3 py-1 rounded ${
              page === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300 hover:bg-gray-400'
            }`}
          >
            Previous
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Show pages around current page
            const pageToShow = page > 3 
              ? page - 3 + i + (page + 2 > totalPages ? totalPages - (page + 2) : 0)
              : i + 1;
            
            if (pageToShow <= totalPages) {
              return (
                <button
                  key={pageToShow}
                  onClick={() => handlePageChange(pageToShow)}
                  className={`px-3 py-1 rounded ${
                    page === pageToShow ? 'bg-blue-500 text-white' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                >
                  {pageToShow}
                </button>
              );
            }
            return null;
          })}
          
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className={`px-3 py-1 rounded ${
              page >= totalPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300 hover:bg-gray-400'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">User Management</h2>
      
        {/* Search and filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <input
              type="text"
              placeholder="Search users..."
              className="w-full px-4 py-2 border rounded-lg"
              onChange={e => handleFilterChange('isVerified', e.target.value === '' ? undefined : e.target.value === 'true')}
              value={filters.isVerified === undefined ? '' : filters.isVerified.toString()}
            >
              <option value="">All Verification</option>
              <option value="true">Verified</option>
              <option value="false">Not Verified</option>
            </select>
          </div>
          
          {/* Results per page */}
          <div>
            <select
              className="px-4 py-2 border rounded-lg bg-white"
              onChange={e => handleLimitChange(Number(e.target.value))}
              value={limit}
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>
        
        {/* User list */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-gray-500 font-medium">
                            {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            {user.lastName?.[0]?.toUpperCase() || ''}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">
                        {user.emailVerified ? (
                          <span className="text-green-600">Verified</span>
                        ) : (
                          <span className="text-yellow-600">Not verified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === UserRole.ADMIN
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === UserRole.TAILOR
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.displayRole || user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a 
                        href={`/users/${user.id}`} 
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </a>
                      <a 
                        href={`/users/${user.id}/edit`} 
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {renderPagination()}={e => handleSearch(e.target.value)}
            />
          </div>
          
          {/* Role filter */}
          <div>
            <select
              className="px-4 py-2 border rounded-lg bg-white"
              onChange={e => handleRoleFilter(e.target.value as UserRole | '')}
              value={filters.role || ''}
            >
              <option value="">All Roles</option>
              <option value={UserRole.CLIENT}>Client</option>
              <option value={UserRole.TAILOR}>Tailor</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>
          
          {/* Status filter */}
          <div>
            <select
              className="px-4 py-2 border rounded-lg bg-white"
              onChange={e => handleFilterChange('isActive', e.target.value === '' ? undefined : e.target.value === 'true')}
              value={filters.isActive === undefined ? '' : filters.isActive.toString()}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          
          {/* Verification filter */}
          <div>
            <select
              className="px-4 py-2 border rounded-lg bg-white"
              onChange