import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const UserStatus: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="flex items-center">
      <div className="mr-4">
        <p className="text-sm font-medium text-gray-900">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="text-xs text-gray-500">{user?.role}</p>
      </div>
      <button
        onClick={logout}
        className="px-3 py-1 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
};

export default UserStatus;