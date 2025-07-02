import React from 'react';
import { UserRole } from '../../types/user';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

interface RoleBasedButtonProps {
  requiredRoles?: UserRole | UserRole[];
  requiredPermission?: string | string[];
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

const RoleBasedButton: React.FC<RoleBasedButtonProps> = ({
  requiredRoles,
  requiredPermission,
  onClick,
  className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50',
  disabled = false,
  children
}) => {
  const { hasRole } = useAuth();
  const { hasPermission } = usePermissions();
  
  const hasAccess = 
    (!requiredRoles || hasRole(requiredRoles)) && 
    (!requiredPermission || hasPermission(requiredPermission));
  
  if (!hasAccess) {
    return null;
  }
  
  return (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default RoleBasedButton;