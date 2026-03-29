import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAuthToken } from '../api';

const AuthContext = createContext(null);

const STORAGE_KEY = 's-chain-auth';

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const accessToken = parsed.accessToken || parsed.token;
    const refreshToken = parsed.refreshToken ?? null;
    const user = parsed.user;
    if (accessToken && user) {
      return { accessToken, refreshToken, user };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted) {
      setToken(persisted.accessToken);
      setRefreshToken(persisted.refreshToken);
      setUser(persisted.user);
      setAuthToken(persisted.accessToken);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const onRefresh = (e) => {
      setToken(e.detail.accessToken);
      setRefreshToken(e.detail.refreshToken);
    };
    const onCleared = () => {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    };
    window.addEventListener('s-chain-auth-refreshed', onRefresh);
    window.addEventListener('s-chain-auth-cleared', onCleared);
    return () => {
      window.removeEventListener('s-chain-auth-refreshed', onRefresh);
      window.removeEventListener('s-chain-auth-cleared', onCleared);
    };
  }, []);

  const persist = (accessToken, refresh, u) => {
    setToken(accessToken);
    setRefreshToken(refresh ?? null);
    setUser(u);
    setAuthToken(accessToken);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken,
        refreshToken: refresh ?? null,
        user: u,
      })
    );
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data.accessToken, data.refreshToken, data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    persist(data.accessToken, data.refreshToken, data.user);
    return data.user;
  };

  const logout = async () => {
    const rt = refreshToken || readPersisted()?.refreshToken;
    try {
      if (rt) {
        await api.post('/auth/logout', { refreshToken: rt });
      }
    } catch {
      /* still clear client */
    }
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      refreshToken,
      ready,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin',
      isLogistics: user?.role === 'logistics_manager',
      isCustomer: user?.role === 'customer',
    }),
    [user, token, refreshToken, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
