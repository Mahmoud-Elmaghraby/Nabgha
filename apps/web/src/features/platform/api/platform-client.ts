import axios from 'axios';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (window.location.port === '' || window.location.port === '443' || window.location.port === '80') {
    return '/api/v1';
  }
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  return `${protocol}//${host}:3001/api/v1`;
};

const API_URL = getApiUrl();

export const platformClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

platformClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function forcePlatformLogout() {
  localStorage.removeItem('platform_accessToken');
  localStorage.removeItem('platform_refreshToken');
  localStorage.removeItem('platform_user');
  if (!window.location.pathname.startsWith('/platform/login')) {
    window.location.replace('/platform/login');
  }
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

platformClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (original.url?.includes('/auth/refresh')) {
      forcePlatformLogout();
      return Promise.reject(error);
    }
    // بيانات دخول غلط في صفحة دخول المنصة — نرجّع الخطأ للصفحة على طول
    // (قبل كده كان بيحاول يعمل refresh ويطلّع المستخدم بدل ما يوريه الرسالة)
    if (original.url?.includes('/auth/platform/login')) {
      return Promise.reject(error);
    }
    original._retry = true;
    if (isRefreshing) {
      return new Promise((resolve) => {
        addSubscriber((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(platformClient(original));
        });
      });
    }
    isRefreshing = true;
    try {
      const refreshToken = localStorage.getItem('platform_refreshToken');
      if (!refreshToken) {
        forcePlatformLogout();
        return Promise.reject(error);
      }
      const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: rotated } = res.data.data;
      localStorage.setItem('platform_accessToken', accessToken);
      if (rotated) localStorage.setItem('platform_refreshToken', rotated);
      isRefreshing = false;
      onRefreshed(accessToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return platformClient(original);
    } catch (refreshError) {
      isRefreshing = false;
      refreshSubscribers = [];
      forcePlatformLogout();
      return Promise.reject(refreshError);
    }
  },
);
