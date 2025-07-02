import React from 'react';
import { UserRole } from '../../types/user';
import { useAuth } from '../../contexts/AuthContext';

interface RoleBasedContentProps {
  requiredRoles: UserRole | UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const RoleBasedContent: React.FC<RoleBasedContentProps> = ({
  requiredRoles,
  fallback = null,
  children
}) => {
  const { isAuthenticated, hasRole } = useAuth();

  // Not authenticated at all
  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // Check if user has the required role(s)
  if (hasRole(requiredRoles)) {
    return <>{children}</>;
  }

  // User doesn't have the required role
  return <>{fallback}</>;
};

export default RoleBasedContent;