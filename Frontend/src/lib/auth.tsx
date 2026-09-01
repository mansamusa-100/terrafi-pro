import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import { api, setToken, getToken, SubscriptionView } from './api';
import { AppUser, firstPageFor } from './rbac';

interface AuthContextValue {
  user: AppUser | null;
  subscription: SubscriptionView | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (userId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setSubscription: (sub: SubscriptionView | null) => void;
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
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user: u, subscription: s }) => {
        setUser(u);
        setSubscription(s ?? null);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      setToken(result.token);
      setUser(result.user);
      setSubscription(result.subscription ?? null);
      onUserChange?.(firstPageFor(result.user));
    },
    [onUserChange]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSubscription(null);
  }, []);

  const switchWorkspace = useCallback(
    async (userId: string) => {
      const { token, user: u, subscription: s } = await api.switchWorkspace(userId);
      setToken(token);
      setUser(u);
      setSubscription(s ?? null);
      onUserChange?.(firstPageFor(u));
    },
    [onUserChange]
  );

  const refreshProfile = useCallback(async () => {
    const { user: u, subscription: s } = await api.me();
    setUser(u);
    setSubscription(s ?? null);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const { user: u } = await api.changePassword({
        currentPassword,
        newPassword
      });
      setUser(u);
      onUserChange?.(firstPageFor(u));
    },
    [onUserChange]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        loading,
        login,
        logout,
        switchWorkspace,
        refreshProfile,
        setSubscription,
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
