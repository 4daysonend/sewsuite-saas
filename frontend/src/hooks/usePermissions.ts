import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/user';

// Define permission constants
export const PERMISSIONS = {
  VIEW_USERS: 'view:users',
  EDIT_USERS: 'edit:users',
  DELETE_USERS: 'delete:users',
  VIEW_ORDERS: 'view:orders',
  EDIT_ORDERS: 'edit:orders',
  VIEW_ANALYTICS: 'view:analytics',
  MANAGE_SYSTEM: 'manage:system',
  // Add more permissions as needed
};

// Define role-based permission mapping
const rolePermissions: Record<UserRole, string[]> = {
  SUPERADMIN: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.EDIT_USERS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.EDIT_ORDERS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  TAILOR: [
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.EDIT_ORDERS,
  ],
  CLIENT: [
    PERMISSIONS.VIEW_ORDERS,
  ],
  GUEST: [],
};

export function usePermissions() {
  const { user, hasRole } = useAuth();
  
  /**
   * Check if current user has the specific permission
   */
  const hasPermission = (permission: string | string[]): boolean => {
    if (!user) return false;
    
    // Superadmin has all permissions
    if (user.role === UserRole.SUPERADMIN) return true;
    
    // Get permissions for the user's role
    const userPermissions = rolePermissions[user.role as UserRole] || [];
    
    // Check for specific permissions from JWT if available
    const tokenPermissions = user.permissions || [];
    
    const allPermissions = [...userPermissions, ...tokenPermissions];
    
    if (Array.isArray(permission)) {
      return permission.some(p => allPermissions.includes(p));
    }
    
    return allPermissions.includes(permission);
  };
  
  return {
    hasPermission,
    hasRole,
    PERMISSIONS,
  };
}