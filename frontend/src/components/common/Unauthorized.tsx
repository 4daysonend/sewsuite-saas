// sewsuite-saas\frontend\src\components\common\Unauthorized.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Unauthorized: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m2-6a2 2 0 00-2 2c0 .39.1.74.26 1.05l1.49 2.97a1 1 0 001.5 0l1.49-2.97A2.1 2.1 0 0014 11a2 2 0 00-2-2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Access Denied</h2>
        <p className="mt-2 text-base text-gray-600">
          You don't have permission to access this page.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Current role: {user?.role || 'Unknown'}
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;