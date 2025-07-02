// sewsuite-saas\frontend\src\contexts\AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { User, UserRole } from '../types/user';
import { get, post } from '../lib/api';
import { setSecureCookie, getSecureCookie, removeSecureCookie } from '../utils/cookies';
import { checkLoginRateLimit, recordLoginAttempt } from '../utils/rateLimit';
import { logEvent } from '../utils/logger';

// Define auth context state interface
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: Partial<User>) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => false,
  register: async () => false,
  logout: () => {},
  refreshUser: async () => {},
  hasRole: () => false,
});

// Role hierarchy for permission checking
const roleHierarchy: Record<UserRole, number> = {
  SUPERADMIN: 100,
  ADMIN: 80,
  TAILOR: 50,
  CLIENT: 10,
  GUEST: 0,
};

// Auth Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Check if token is about to expire and needs refresh
  useEffect(() => {
    if (!user) return;

    const token = getSecureCookie('token');
    if (!token) return;

    try {
      const decoded = jwtDecode<{ exp: number }>(token);
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;
      
      // If token expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        refreshTokenSilently();
      } else {
        // Set timeout to refresh token 5 minutes before expiry
        const refreshTimeout = setTimeout(
          refreshTokenSilently,
          timeUntilExpiry - 5 * 60 * 1000
        );
        return () => clearTimeout(refreshTimeout);
      }
    } catch (error) {
      console.error('Failed to check token expiration:', error);
    }
  }, [user]);

  // Get current user data from API
  const fetchCurrentUser = async (): Promise<User> => {
    try {
      return await get<User>('/auth/me');
    } catch (error) {
      throw new Error('Failed to fetch user data');
    }
  };

  // Refresh token without user interaction
  const refreshTokenSilently = async (): Promise<void> => {
    const refreshToken = getSecureCookie('refreshToken');
    if (!refreshToken) {
      logout();
      return;
    }

    try {
      const response = await post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { refresh_token: refreshToken }
      );

      setSecureCookie('token', response.access_token, { 
        secure: true, 
        sameSite: 'strict',
        maxAge: 3600, // 1 hour
      });

      setSecureCookie('refreshToken', response.refresh_token, { 
        secure: true, 
        sameSite: 'strict',
        httpOnly: true,
        maxAge: 7 * 24 * 3600, // 7 days
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      logEvent('security', 'error', 'Token refresh failed', { error });
    }
  };

  // Extract role from token
  const extractRoleFromToken = (token: string): UserRole => {
    try {
      const decoded = jwtDecode<{ role: UserRole }>(token);
      return decoded.role;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return UserRole.GUEST;
    }
  };

  // Refresh user data from API
  const refreshUser = async (): Promise<void> => {
    const token = getSecureCookie('token');
    
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Extract role from token first for immediate UI update
      const tokenRole = extractRoleFromToken(token);
      
      // Fetch full user data from API
      const userData = await fetchCurrentUser();
      
      // Compare roles for security
      if (userData.role !== tokenRole) {
        console.warn('Role mismatch between token and user data!', {
          tokenRole,
          userDataRole: userData.role
        });
        
        // Log role mismatch
        logEvent('security', 'warning', 'Role mismatch between token and user data', {
          tokenRole,
          userDataRole: userData.role
        });
        
        // Use the more restrictive role for security
        // This prevents elevation of privilege if backend role is lower than token role
        if (roleHierarchy[tokenRole] > roleHierarchy[userData.role]) {
          userData.role = tokenRole;
        }
      }
      
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      
      // If API call fails but we have a valid token, create a minimal user object from the token
      if (token) {
        try {
          const decoded = jwtDecode<JwtPayload>(token);
          // Set minimal user data from token to allow basic functionality
          setUser({
            id: decoded.sub,
            role: decoded.role,
            email: '',
            firstName: '',
            lastName: '',
            // Add other required user fields with default values
          });
        } catch (tokenError) {
          // If token is invalid, clear everything
          removeSecureCookie('token');
          removeSecureCookie('refreshToken');
          setUser(null);
        }
      } else {
        removeSecureCookie('token');
        removeSecureCookie('refreshToken');
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    // Check rate limit before attempting login
    const rateLimit = checkLoginRateLimit();
    if (!rateLimit.allowed) {
      setError(rateLimit.message || 'Too many login attempts. Try again later.');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await post<{ 
        access_token: string;
        refresh_token: string;
        user: User;
      }>('/auth/login', { email, password });

      // Record successful login
      recordLoginAttempt(true);

      // Store tokens securely in cookies
      setSecureCookie('token', response.access_token, { 
        secure: true, 
        sameSite: 'strict',
        maxAge: 3600, // 1 hour
      });

      setSecureCookie('refreshToken', response.refresh_token, { 
        secure: true, 
        sameSite: 'strict',
        httpOnly: true,
        maxAge: 7 * 24 * 3600, // 7 days
      });

      // Set user data from response
      setUser(response.user);

      // Log the successful login
      logEvent('auth', 'info', `User logged in: ${response.user.email}`);
      
      return true;
    } catch (error: any) {
      // Record failed login
      recordLoginAttempt(false);
      
      // Log the failed login attempt
      logEvent('auth', 'warning', `Failed login attempt for: ${email}`, { 
        reason: error.message 
      });

      const errorMessage = error.message || 'Login failed. Please try again.';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (userData: Partial<User>): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      await post('/auth/register', userData);
      
      return true;
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Clear tokens
    removeSecureCookie('token');
    removeSecureCookie('refreshToken');
    
    // Clear user data
    setUser(null);
    
    // Optional: Call logout endpoint to invalidate token on server
    try {
      post('/auth/logout', {});
      
      // Log the logout event
      logEvent('auth', 'info', `User logged out: ${user?.email || 'Unknown user'}`);
    } catch (error) {
      // Silent fail - user is logged out locally regardless
      console.warn('Failed to logout on server:', error);
    }
  };

  // Role checking function
  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    
    const userRoleLevel = roleHierarchy[user.role as UserRole] || 0;
    
    if (Array.isArray(roles)) {
      return roles.some(role => {
        const requiredRoleLevel = roleHierarchy[role as UserRole] || 0;
        return userRoleLevel >= requiredRoleLevel;
      });
    } else {
      const requiredRoleLevel = roleHierarchy[roles] || 0;
      return userRoleLevel >= requiredRoleLevel;
    }
  };

  // Auth context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    hasRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext);

// Add after line 5, with your other imports and interfaces
interface JwtPayload {
  sub: string;
  role: UserRole;
  permissions?: string[];
  exp: number;
  iat: number;
}