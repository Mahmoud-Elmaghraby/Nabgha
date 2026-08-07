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

export const PARENT_API_URL = getApiUrl();

export const parentClient = axios.create({
  baseURL: PARENT_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

parentClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('parent_accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function forceParentLogout() {
  const slug = localStorage.getItem('parent_slug');
  localStorage.removeItem('parent_accessToken');
  localStorage.removeItem('parent_students');
  const loginPath = slug ? `/parent/${slug}/login` : '/parent';
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  }
}

// مفيش refresh token في بوابة الأهالي (توكن واحد صالح لمدة 30 يوم) —
// فأي 401 معناها التوكن باين منتهي/غير صالح، نرجّع ولي الأمر لصفحة الدخول على طول.
parentClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      forceParentLogout();
    }
    return Promise.reject(error);
  },
);
