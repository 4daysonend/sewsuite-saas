import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * AuthGuard component for protecting routes and UI elements based on user permissions
 * 
 * Usage examples:
 * 
 * 1. Protect a route:
 *    <Route path="/admin" element={
 *      <AuthGuard requiredRole="ADMIN" redirectTo="/login">
 *        <AdminDashboard />
 *      </AuthGuard>
 *    } />
 * 
 * 2. Conditionally render UI elements:
 *    <AuthGuard 
 *      requiredPermission="order:delete" 
 *      fallback={<p>You don't have permission to delete orders</p>}
 *    >
 *      <DeleteButton onClick={handleDelete} />
 *    </AuthGuard>
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requiredPermission,
  requiredRole,
  redirectTo = '/login',
  fallback = null
}) => {
  const { user, isAuthenticated, hasRole, canAccess } = useAuth();

  // Not authenticated at all
  if (!isAuthenticated || !user) {
    return redirectTo ? <Navigate to={redirectTo} /> : <>{fallback}</>;
  }

  // Check role if specified
  if (requiredRole && !hasRole(requiredRole)) {
    return redirectTo ? <Navigate to={redirectTo} /> : <>{fallback}</>;
  }

  // Check permission if specified
  if (requiredPermission && !canAccess(requiredPermission)) {
    return redirectTo ? <Navigate to={redirectTo} /> : <>{fallback}</>;
  }

  // All checks passed
  return <>{children}</>;
};

/**
 * Permission-based UI rendering component
 */
interface PermissionGuardProps {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  fallback = null
}) => {
  const { canAccess } = useAuth();
  
  return canAccess(permission) ? <>{children}</> : <>{fallback}</>;
};

/**
 * Role-based UI rendering component
 */
interface RoleGuardProps {
  children: React.ReactNode;
  role: string;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  role,
  fallback = null
}) => {
  const { hasRole } = useAuth();
  
  return hasRole(role) ? <>{children}</> : <>{fallback}</>;
};

export default AuthGuard;