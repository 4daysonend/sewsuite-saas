import React, { useState } from 'react';
import { useData } from '../../hooks/useDataFetching';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import UserFilters from './UserFilters';
import UserTable from './UserTable';
import { UserRole } from '../../types/user';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string;
  createdAt: string;
}

interface UsersResponse {
  items: User[];
  meta: {
    totalItems: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

// Function to prefetch users data for SSR
export const loadUsersData = async (page = 1, filters = {}) => {
  try {
    return await get<UsersResponse>('/users', {
      params: { page, ...filters }
    });
  } catch (error) {
    console.error('Failed to load users:', error);
    return { 
      items: [], 
      meta: { totalItems: 0, itemsPerPage: 10, totalPages: 0, currentPage: 1 } 
    };
  }
};

interface UserManagementProps {
  initialData?: UsersResponse;
}

const UserManagement: React.FC<UserManagementProps> = ({ initialData }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, any>>({});

  // Build API URL with query parameters
  const apiUrl = `/users?page=${page}${
    Object.entries(filters)
      .map(([key, value]) => `&${key}=${encodeURIComponent(String(value))}`)
      .join('')
  }`;

  const { data, error, isLoading, mutate } = useData<UsersResponse>(
    apiUrl,
    { initialData }
  );

  const handleFilterChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleAddUser = () => {
    navigate('/admin/users/new');
  };

  const handleEditUser = (userId: string) => {
    navigate(`/admin/users/${userId}/edit`);
  };

  const handleViewUser = (userId: string) => {
    navigate(`/admin/users/${userId}`);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message="Failed to load users. Please try again later." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button
          onClick={handleAddUser}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add User
        </button>
      </div>

      <UserFilters currentFilters={filters} onFilterChange={handleFilterChange} />

      {data?.items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <UserTable 
          users={data?.items || []} 
          onEdit={handleEditUser}
          onView={handleViewUser}
        />
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <nav className="flex items-center">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Previous
            </button>
            <span className="mx-4">
              Page {data.meta.currentPage} of {data.meta.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(data.meta.totalPages, page + 1))}
              disabled={page === data.meta.totalPages}
              className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default UserManagement;