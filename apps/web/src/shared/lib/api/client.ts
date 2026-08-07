import axios from 'axios';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // في الـ production على nginx — استخدم relative URL
  if (window.location.port === '' || window.location.port === '443' || window.location.port === '80') {
    return '/api/v1';
  }
  // في الـ dev — استخدم نفس الـ protocol للـ frontend لتجنب Mixed Content
  // لو الـ frontend على https، الـ API لازم يكون https برضو
  const protocol = window.location.protocol; // 'https:' or 'http:'
  const host = window.location.hostname;
  return `${protocol}//${host}:3001/api/v1`;
};
const API_URL = getApiUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ===== Request interceptor — إضافة التوكن =====
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===== Refresh queue — لمنع الـ race condition =====
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function forceLogout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  // نتجنب الـ redirect المتكرر لو احنا أصلاً في صفحة اللوجين
  if (!window.location.pathname.startsWith('/auth/login')) {
    window.location.replace('/auth/login');
  }
}

// ===== Response interceptor — معالجة 401 =====
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // مش 401، أو الطلب اتعاد قبل كده → ارفض عادي
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // الـ refresh نفسه فشل → اطرد فوراً
    if (original.url?.includes('/auth/refresh')) {
      forceLogout();
      return Promise.reject(error);
    }

    original._retry = true;

    // لو في refresh شغال بالفعل → استنى نتيجته بدل ما تبدأ واحد جديد
    if (isRefreshing) {
      return new Promise((resolve) => {
        addSubscriber((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    // ابدأ refresh جديد
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { accessToken } = res.data.data;

      localStorage.setItem('accessToken', accessToken);
      isRefreshing = false;
      onRefreshed(accessToken);

      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      isRefreshing = false;
      refreshSubscribers = [];
      forceLogout();
      return Promise.reject(refreshError);
    }
  },
);
