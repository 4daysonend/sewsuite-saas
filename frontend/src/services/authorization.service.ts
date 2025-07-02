// frontend/src/services/authorization.service.ts
import { User, UserRole } from '../types/user';

// Define the permission structure
export type Permission = string;

// Define the role hierarchy and permissions map
interface RolePermissions {
  [key: string]: Permission[];
}

class AuthorizationService {
  hasRole(user: User, requiredRole: string) {
    throw new Error('Method not implemented.');
  }
  private roleHierarchy: Record<UserRole, UserRole[]> = {
    [UserRole.ADMIN]: [UserRole.TAILOR, UserRole.CLIENT],
    [UserRole.TAILOR]: [UserRole.CLIENT],
    [UserRole.CLIENT]: [],
  };

  // Define permissions for each role
  private rolePermissions: RolePermissions = {
    [UserRole.ADMIN]: [
      'user:read',
      'user:create',
      'user:update',
      'user:delete',
      'order:read',
      'order:create',
      'order:update',
      'order:delete',
      'product:read',
      'product:create',
      'product:update',
      'product:delete',
      'payment:read',
      'payment:process',
      'settings:read',
      'settings:update',
      'analytics:read',
    ],
    [UserRole.TAILOR]: [
      'order:read',
      'order:update',
      'product:read',
      'product:create',
      'product:update',
      'payment:read',
      'profile:read',
      'profile:update',
    ],
    [UserRole.CLIENT]: [
      'order:read',
      'order:create',
      'product:read',
      'payment:read',
      'payment:create',
      'profile:read',
      'profile:update',
    ],
  };

  /**
   * Check if a user with the given role has a specific permission
   */
  hasPermission(userRole: UserRole, permission: Permission): boolean {
    // Get all permissions for this role and its subordinate roles
    const allPermissions = this.getAllPermissionsForRole(userRole);
    return allPermissions.includes(permission);
  }

  /**
   * Check if a user with the given role can perform an action on a specific resource
   */
  canAccess(userRole: UserRole, action: string, resource: string): boolean {
    const permission = `${resource}:${action}`;
    return this.hasPermission(userRole, permission);
  }

  /**
   * Get all permissions for a role, including inherited permissions
   */
  getAllPermissionsForRole(role: UserRole): Permission[] {
    // Start with the permissions for this role
    let permissions = [...this.rolePermissions[role]];

    // Add permissions from subordinate roles
    const subordinateRoles = this.getSubordinateRoles(role);
    for (const subordinateRole of subordinateRoles) {
      permissions = [...permissions, ...this.rolePermissions[subordinateRole]];
    }

    // Remove duplicates
    return [...new Set(permissions)];
  }

  /**
   * Check if a user role has authority over another role
   */
  hasAuthorityOver(userRole: UserRole, targetRole: UserRole): boolean {
    if (userRole === targetRole) {
      return true; // A role has authority over itself
    }
    
    return this.getSubordinateRoles(userRole).includes(targetRole);
  }

  /**
   * Get all subordinate roles for the given role based on the hierarchy
   */
  private getSubordinateRoles(role: UserRole): UserRole[] {
    return this.roleHierarchy[role];
  }
}

export default new AuthorizationService();