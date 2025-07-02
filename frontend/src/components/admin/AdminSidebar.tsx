import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/user';
import { IconType } from 'react-icons';
import { 
  FiUsers, 
  FiSettings, 
  FiActivity, 
  FiBarChart, 
  FiFileText, 
  FiCreditCard,
  FiDatabase,
  FiLayers
} from 'react-icons/fi';

interface SidebarItem {
  name: string;
  path: string;
  icon: IconType;
  roles: UserRole[];
}

const AdminSidebar: React.FC = () => {
  const { hasRole } = useAuth();
  const location = useLocation();
  
  const sidebarItems: SidebarItem[] = [
    { 
      name: 'User Management', 
      path: '/admin/users', 
      icon: FiUsers,
      roles: [UserRole.ADMIN]
    },
    { 
      name: 'System Monitoring', 
      path: '/admin/monitoring', 
      icon: FiActivity,
      roles: [UserRole.ADMIN]
    },
    { 
      name: 'Analytics', 
      path: '/admin/analytics', 
      icon: FiBarChart,
      roles: [UserRole.ADMIN]
    },
    { 
      name: 'Reports', 
      path: '/admin/reports', 
      icon: FiFileText,
      roles: [UserRole.ADMIN, UserRole.TAILOR]
    },
    { 
      name: 'Payment Management', 
      path: '/admin/payments', 
      icon: FiCreditCard,
      roles: [UserRole.ADMIN]
    },
    { 
      name: 'Data Management', 
      path: '/admin/data', 
      icon: FiDatabase,
      roles: [UserRole.ADMIN]
    },
    { 
      name: 'Template Management', 
      path: '/admin/templates', 
      icon: FiLayers,
      roles: [UserRole.ADMIN, UserRole.TAILOR]
    },
    { 
      name: 'Settings', 
      path: '/admin/settings', 
      icon: FiSettings,
      roles: [UserRole.ADMIN]
    },
  ];

  // Filter items based on user role
  const filteredItems = sidebarItems.filter(item => {
    return hasRole(item.roles);
  });

  return (
    <div className="w-64 bg-white shadow-md h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Admin Panel</h2>
      </div>
      <nav className="mt-5 px-2">
        <div className="space-y-1">
          {filteredItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon 
                  className={`mr-3 h-5 w-5 ${
                    isActive
                      ? 'text-blue-500'
                      : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AdminSidebar;