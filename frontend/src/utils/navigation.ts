import { UserRole } from '../types/user';

// Safe paths that don't require permission checks
const SAFE_REDIRECT_PATHS = [
  '/dashboard',
  '/orders',
  '/profile',
  '/account'
];

// Role-based home pages
const ROLE_HOME_PAGES: Record<UserRole, string> = {
  SUPERADMIN: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  TAILOR: '/projects',
  CLIENT: '/dashboard',
  GUEST: '/login'
};

/**
 * Gets a safe redirect URL after login
 */
export const getSafeRedirect = (
  redirectPath: string | undefined, 
  userRole: UserRole
): string => {
  // If no redirect specified or invalid, use role-based homepage
  if (!redirectPath || !redirectPath.startsWith('/')) {
    return ROLE_HOME_PAGES[userRole] || '/dashboard';
  }
  
  // Check if path is in safe list
  if (SAFE_REDIRECT_PATHS.some(path => redirectPath.startsWith(path))) {
    return redirectPath;
  }
  
  // Redirect to role-specific homepage
  return ROLE_HOME_PAGES[userRole] || '/dashboard';
};