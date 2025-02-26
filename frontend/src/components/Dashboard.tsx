// sewsuite-saas\frontend\src\components\Dashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStorageQuota } from '../hooks/useStorageQuota';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { quota, loading: quotaLoading, formatBytes } = useStorageQuota();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          
          <div className="mt-4">
            <div className="bg-white shadow-sm rounded-lg overflow-hidden p-6">
              <h2 className="text-lg font-medium text-gray-900">Welcome back, {user?.firstName || user?.email}!</h2>
              
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Profile Card */}
                <div className="bg-white overflow-hidden shadow-sm rounded-lg divide-y divide-gray-200">
                  <div className="px-4 py-5 sm:px-6">
                                      <h3 className="text-lg font-medium text-gray-900">Profile</h3>
                                      // sewsuite-saas\frontend\src\components\Dashboard.tsx (continued)
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-gray-500">Name</div>
                        <div className="mt-1 text-sm text-gray-900">{user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Not set'}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500">Email</div>
                        <div className="mt-1 text-sm text-gray-900">{user?.email}</div>
                        {user?.emailVerified ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                            Not verified
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500">Role</div>
                        <div className="mt-1 text-sm text-gray-900 capitalize">{user?.role}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Link
                        to="/profile"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Storage Quota Card */}
                <div className="bg-white overflow-hidden shadow-sm rounded-lg divide-y divide-gray-200">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg font-medium text-gray-900">Storage</h3>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    {quotaLoading ? (
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : quota ? (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">
                              {formatBytes(quota.used)} of {formatBytes(quota.total)}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {quota.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                quota.percentage < 60 ? 'bg-blue-500' : 
                                quota.percentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(quota.percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Link
                            to="/files"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                          >
                            Manage Files
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Unable to load storage information.</div>
                    )}
                  </div>
                </div>

                {/* Quick Links Card */}
                <div className="bg-white overflow-hidden shadow-sm rounded-lg divide-y divide-gray-200">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg font-medium text-gray-900">Quick Links</h3>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <nav className="space-y-1" aria-label="Sidebar">
                      <Link
                        to="/orders"
                        className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex px-3 py-2 text-sm font-medium rounded-md"
                      >
                        <svg className="text-gray-400 mr-3 flex-shrink-0 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Orders
                      </Link>

                      <Link
                        to="/files"
                        className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex px-3 py-2 text-sm font-medium rounded-md"
                      >
                        <svg className="text-gray-400 mr-3 flex-shrink-0 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        Files
                      </Link>

                      {user?.role === 'admin' && (
                        <>
                          <Link
                            to="/admin/users"
                            className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex px-3 py-2 text-sm font-medium rounded-md"
                          >
                            <svg className="text-gray-400 mr-3 flex-shrink-0 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Manage Users
                          </Link>

                          <Link
                            to="/admin/system-health"
                            className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex px-3 py-2 text-sm font-medium rounded-md"
                          >
                            <svg className="text-gray-400 mr-3 flex-shrink-0 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            System Health
                          </Link>
                        </>
                      )}
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;