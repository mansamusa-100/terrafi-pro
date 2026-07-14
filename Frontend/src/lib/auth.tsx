import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import { api, setToken, getToken } from './api';
import { AppUser, firstPageFor } from './rbac';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (userId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
    async (email: string, password: string) => {
      const result = await api.login(email, password);
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

  const switchWorkspace = useCallback(
    async (userId: string) => {
      const { token, user: u } = await api.switchWorkspace(userId);
      setToken(token);
      setUser(u);
      onUserChange?.(firstPageFor(u.role));
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
        switchWorkspace,
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
