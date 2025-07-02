// sewsuite-saas/frontend/src/hooks/useUser.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/user';
import userService, { mockUserService } from '../services/userService';
import { useMockServices } from '../utils/environment';
import useSWR from 'swr';
import { get } from '../lib/api';

const fetcher = (url: string) => get(url);

interface UseUserOptions {
  fetchOnMount?: boolean;
  initialData?: User | null;
}

interface UseUserReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  fetchUser: (id?: string) => Promise<User | null>;
  updateUser: (data: Partial<User>) => void;
  refreshUser: () => Promise<User | null>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTailor: boolean;
  isClient: boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllRoles: (roles: UserRole[]) => boolean;
}

// Main hook for user authentication and role management
export function useUser(userId?: string, options: UseUserOptions = {}): UseUserReturn {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    refreshUser: authRefreshUser
  } = useAuth();
  
  const [fetchedUser, setFetchedUser] = useState<User | null>(options.initialData || null);
  const [loading, setLoading] = useState<boolean>(options.fetchOnMount !== false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isAdmin = hasRole(UserRole.ADMIN);
  const isTailor = hasRole(UserRole.TAILOR);
  const isClient = hasRole(UserRole.CLIENT) || (isAuthenticated && !isAdmin && !isTailor);

  const fetchUser = useCallback(async (id?: string): Promise<User | null> => {
    try {
      setLoading(true);
      setFetchError(null);
      
      const targetId = id || userId;
      
      let userData: User;
      
      if (targetId) {
        userData = await userService.getUser(targetId);
      } else {
        userData = await userService.getCurrentUser();
      }
      
      setFetchedUser(userData);
      return userData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user data';
      setFetchError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!fetchedUser?.id && !userId) return null;
    return fetchUser(fetchedUser?.id || userId);
  }, [fetchedUser?.id, userId, fetchUser]);

  const updateUser = useCallback((data: Partial<User>) => {
    if (fetchedUser) {
      setFetchedUser(currentUser => ({
        ...currentUser!,
        ...data
      }));
    }
  }, [fetchedUser]);

  // Fetch data on mount if option is enabled
  useEffect(() => {
    if (options.fetchOnMount !== false && !options.initialData) {
      fetchUser();
    } else if (options.initialData) {
      setLoading(false);
    }
  }, [options.fetchOnMount, options.initialData, fetchUser]);

  // SWR for user data fetching
  const { data, error: swrError, mutate } = useSWR(
    userId ? `/users/${userId}` : null,
    fetcher
  );

  return {
    user: fetchedUser || (data as User),
    loading: loading || (!swrError && !data),
    error: fetchError || (swrError ? 'Failed to fetch user data' : null),
    fetchUser,
    updateUser,
    refreshUser,
    isAuthenticated,
    isAdmin,
    isTailor,
    isClient,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    mutate
  };
}

// Extended hook for fetching and managing user details
export function useUserDetails(userId?: string) {
  const { user: currentUser } = useAuth();
  const service = useMockServices ? mockUserService : userService;
  
  const fetchUser = useCallback(async (id?: string) => {
    const targetId = id || userId || currentUser?.id;
    if (!targetId) {
      throw new Error('No user ID provided');
    }
    
    return service.getUser(targetId);
  }, [userId, currentUser?.id, service]);
  
  return {
    fetchUser
  };
}

export default useUser;