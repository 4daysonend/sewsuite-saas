// sewsuite-saas\frontend\src\components\common\Unauthorized.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import { useUser } from '../../hooks/useUser';

const Unauthorized: React.FC = () => {
  const { isAuthenticated, user } = useUser();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-lg shadow-md">
        <div className="flex flex-col items-center">
          <FiAlertTriangle className="text-yellow-500" size={64} />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {isAuthenticated ? (
            <>
              <p className="text-center text-sm text-gray-500">
                Logged in as: <span className="font-semibold">{user?.email}</span>
                <br />
                Role: <span className="font-semibold">{user?.role}</span>
              </p>
              <div className="text-center">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Return to Dashboard
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <p>Please log in to access the application.</p>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Log In
              </Link>
            </div>
          )}
          
          <p className="mt-6 text-center text-xs text-gray-500">
            If you believe this is a mistake, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;