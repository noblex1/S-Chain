import axios from 'axios';

const STORAGE_KEY = 's-chain-auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function authExemptUrl(url) {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/bootstrap-admin')
  );
}

let refreshPromise = null;

async function performRefresh() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : null;
  const rt = parsed?.refreshToken;
  if (!rt) throw new Error('No refresh token');

  const { data } = await axios.post('/api/auth/refresh', { refreshToken: rt });
  const { accessToken, refreshToken } = data;
  const next = {
    user: parsed.user,
    accessToken,
    refreshToken,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setAuthToken(accessToken);
  window.dispatchEvent(new CustomEvent('s-chain-auth-refreshed', { detail: { accessToken, refreshToken } }));
  return accessToken;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config;
    if (!config || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    if (config._retry || authExemptUrl(config.url)) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccess = await refreshPromise;
      config.headers.Authorization = `Bearer ${newAccess}`;
      return api(config);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent('s-chain-auth-cleared'));
      return Promise.reject(error);
    }
  }
);

export default api;
