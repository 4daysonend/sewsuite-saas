import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/user';
import { IconType } from 'react-icons';
import { 
  FiHome,
  FiShoppingBag,
  FiFileText,
  FiFolder,
  FiScissors,
  FiTrendingUp,
  FiCalendar,
  FiMessageSquare,
  FiHelpCircle,
  FiSettings
} from 'react-icons/fi';

interface SidebarItem {
  name: string;
  path: string;
  icon: IconType;
  roles: UserRole[];
}

const DashboardSidebar: React.FC = () => {
  const { hasRole } = useAuth();
  const location = useLocation();
  
  const sidebarItems: SidebarItem[] = [
    { 
      name: 'Dashboard', 
      path: '/dashboard', 
      icon: FiHome,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Orders', 
      path: '/orders', 
      icon: FiShoppingBag,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Projects', 
      path: '/projects', 
      icon: FiScissors,
      roles: [UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Measurements', 
      path: '/measurements', 
      icon: FiTrendingUp,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Files', 
      path: '/files', 
      icon: FiFileText,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Templates', 
      path: '/templates', 
      icon: FiFolder,
      roles: [UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Calendar', 
      path: '/calendar', 
      icon: FiCalendar,
      roles: [UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Messages', 
      path: '/messages', 
      icon: FiMessageSquare,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Help', 
      path: '/help', 
      icon: FiHelpCircle,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
    { 
      name: 'Account Settings', 
      path: '/settings', 
      icon: FiSettings,
      roles: [UserRole.CLIENT, UserRole.TAILOR, UserRole.ADMIN]
    },
  ];

  // Filter items based on user role
  const filteredItems = sidebarItems.filter(item => {
    return hasRole(item.roles);
  });

  return (
    <div className="w-64 bg-white shadow-md h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
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

export default DashboardSidebar;