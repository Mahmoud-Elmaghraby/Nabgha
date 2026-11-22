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

    // endpoints الـ auth نفسها (login / refresh / platform login) — لو فشلوا بـ 401
    // ارفض مباشرة بدون أي محاولة refresh، عشان interceptor ميدخلش في loop
    // ومايخليش صفحة اللوجين تتعلق أو تعيد التحميل لما تكون البيانات غلط
    const isAuthEndpoint =
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/platform/auth/login');

    if (isAuthEndpoint) {
      // الـ refresh endpoint فشل → اطرد فوراً
      if (original.url?.includes('/auth/refresh')) {
        forceLogout();
      }
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
// ===== Proactive Token Refresh =====
// بيفحص الـ token كل 5 دقايق — لو هينتهي في خلال 10 دقايق، يجدده في الخلفية
// من غير ما أي API call يفشل بـ 401 أو المستخدم يحس بأي شيء

function getTokenExpiry(token: string): number | null {
  try {
    // الـ JWT بيتشفر بـ base64url (بيستخدم - و _ بدل + و /، وبدون padding)
    // مش base64 عادي — atob() لوحدها بتفشل أو تدي نتيجة غلط لو الـ payload
    // فيه حروف زي - أو _. لازم نحوّلها لـ base64 عادي الأول.
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function proactiveRefresh(): Promise<void> {
  const accessToken  = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!accessToken || !refreshToken) return;

  const expiry = getTokenExpiry(accessToken);
  if (!expiry) return;

  const msUntilExpiry = expiry - Date.now();
  // لو في أقل من 10 دقايق → جدّد
  if (msUntilExpiry > 10 * 60 * 1000) return;

  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const { accessToken: newToken } = res.data.data;
    localStorage.setItem('accessToken', newToken);
    // لو في requests معلقة من interceptor بتستنى refresh → أخطرها بالـ token الجديد
    onRefreshed(newToken);
  } catch {
    // لو الـ refreshToken نفسه انتهى → forceLogout
    forceLogout();
  }
}

// شغّل الفحص فوراً عند تحميل الصفحة وبعدين كل 5 دقايق
proactiveRefresh();
setInterval(proactiveRefresh, 5 * 60 * 1000);
