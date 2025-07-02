import { useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { AuthContext } from '../contexts/AuthContext';
import { getSecureCookie } from '../utils/cookies';
import { UserRole } from '../types/user';

interface JwtClaims {
  sub: string;
  exp: number;
  iat: number;
  role: string;
  permissions?: string[];
}

/**
 * Enhanced auth hook that provides authentication state and methods
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  useEffect(() => {
    // Verify token claims match user state on every render
    const token = getSecureCookie('token');
    if (token && context.user) {
      try {
        const decoded = jwtDecode<JwtClaims>(token);
        
        // If token role doesn't match current role, refresh user data
        if (decoded.role !== context.user.role) {
          console.warn('Role mismatch detected between token and state', {
            tokenRole: decoded.role,
            stateRole: context.user.role
          });
          
          // Force refresh of user data
          context.refreshUser();
        }
      } catch (error) {
        console.error('Failed to verify token claims:', error);
      }
    }
  }, [context.user]);
  
  return context;
}