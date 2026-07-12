import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import { api, setToken, getToken, type LoginResponse } from './api';
import { AppUser, Role, firstPageFor } from './rbac';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    userId?: string
  ) => Promise<LoginResponse | void>;
  logout: () => void;
  switchRole: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_PASSWORD = 'demo';

export function AuthProvider({
  children,
  onUserChange
}: {
  children: React.ReactNode;
  onUserChange?: (page: string) => void;
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string, userId?: string) => {
      const result = await api.login(email, password, userId);
      if (result.requiresWorkspaceSelection) {
        return result;
      }
      setToken(result.token);
      setUser(result.user);
      onUserChange?.(firstPageFor(result.user.role));
    },
    [onUserChange]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const switchRole = useCallback(
    async (email: string) => {
      const { token, user: u } = await api.login(email, DEMO_PASSWORD);
      setToken(token);
      setUser(u);
      onUserChange?.(firstPageFor(u.role as Role));
    },
    [onUserChange]
  );

  const refreshProfile = useCallback(async () => {
    const { user: u } = await api.me();
    setUser(u);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const { user: u } = await api.changePassword({
        currentPassword,
        newPassword
      });
      setUser(u);
      onUserChange?.(firstPageFor(u.role));
    },
    [onUserChange]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        switchRole,
        refreshProfile,
        changePassword
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
