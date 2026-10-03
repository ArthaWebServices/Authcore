import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthCoreClient, createClient, AuthCoreClientOptions, User, TokenPair } from '@authcore/client';

interface AuthContextValue {
  client: AuthCoreClient | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, options?: { rememberMe?: boolean; mfaCode?: string; mfaBackupCode?: string }) => Promise<User | null>;
  register: (email: string, password: string, options?: { fullName?: string; redirectUrl?: string }) => Promise<void>;
  logout: (everywhere?: boolean) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (data: { fullName?: string; avatarUrl?: string; locale?: string; timezone?: string }) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  options: AuthCoreClientOptions;
  onAuthStateChange?: (user: User | null) => void;
}

export function AuthProvider({ children, options, onAuthStateChange }: AuthProviderProps) {
  const [client] = useState(() => createClient(options));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await client.getMe();
      setUser(userData);
      onAuthStateChange?.(userData);
      return userData;
    } catch {
      setUser(null);
      onAuthStateChange?.(null);
      return null;
    }
  }, [client, onAuthStateChange]);

  useEffect(() => {
    const initAuth = async () => {
      if (client.getAccessToken()) {
        await refreshUser();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [client, refreshUser]);

  const login = async (email: string, password: string, options?: { rememberMe?: boolean; mfaCode?: string; mfaBackupCode?: string }) => {
    const result = await client.login({ email, password, ...options });
    client.setAccessToken(result.accessToken);
    client.setRefreshToken(result.refreshToken);
    const userData = await refreshUser();
    return userData;
  };

  const register = async (email: string, password: string, options?: { fullName?: string; redirectUrl?: string }) => {
    await client.register({ email, password, ...options });
  };

  const logout = async (everywhere = false) => {
    await client.logout(everywhere);
    setUser(null);
    onAuthStateChange?.(null);
  };

  const updateProfile = async (data: { fullName?: string; avatarUrl?: string; locale?: string; timezone?: string }) => {
    const updatedUser = await client.updateProfile(data);
    setUser(updatedUser);
    onAuthStateChange?.(updatedUser);
    return updatedUser;
  };

  const value: AuthContextValue = {
    client,
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useAuthLoading(): boolean {
  const { isLoading } = useAuth();
  return isLoading;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

// Higher-order component for protecting routes
interface WithAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function WithAuth({ children, fallback = null, redirectTo }: WithAuthProps) {
  const { isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) {
    return <>{fallback}</>;
  }
  
  if (!isAuthenticated) {
    if (redirectTo && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Hook for checking permissions
export function usePermissions(requiredPermissions: string[]): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  // This would need to be populated from the JWT or fetched separately
  // For now, we'll check if the user has the required permissions in their metadata
  const userPermissions = (user.unsafeMetadata?.permissions as string[]) || [];
  
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

// Hook for checking roles
export function useRoles(requiredRoles: string[]): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  const userRoles = (user.unsafeMetadata?.roles as string[]) || [];
  
  return requiredRoles.some(role => userRoles.includes(role));
}

// Hook for organization context
export function useOrganization(orgId?: string) {
  const { client, user } = useAuth();
  const [organization, setOrganization] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [membership, setMembership] = useState<{ role: string; permissions: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!client || !user || !orgId) return;

    const fetchOrgData = async () => {
      setIsLoading(true);
      try {
        const orgs = await client.listOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (org) {
          setOrganization(org);
          const members = await client.listMembers(orgId);
          const member = members.find(m => m.userId === user.id);
          if (member) {
            setMembership({
              role: member.role.name,
              permissions: member.role.permissions.map(p => p.name),
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrgData();
  }, [client, user, orgId]);

  return { organization, membership, isLoading };
}
