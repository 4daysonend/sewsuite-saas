import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from './Navigation';
import AdminSidebar from '../admin/AdminSidebar';
import DashboardSidebar from '../dashboard/DashboardSidebar';
import { UserRole } from '../../types/user';

const AppLayout: React.FC = () => {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();
  
  const isAdminPage = location.pathname.startsWith('/admin');
  const showSidebar = isAuthenticated && !location.pathname.startsWith('/auth/');
  
  // Determine which sidebar to show
  const renderSidebar = () => {
    if (!showSidebar) return null;
    
    if (isAdminPage && hasRole(UserRole.ADMIN)) {
      return <AdminSidebar />;
    }
    
    return <DashboardSidebar />;
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navigation />
      
      <div className="flex flex-1">
        {renderSidebar()}
        
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;