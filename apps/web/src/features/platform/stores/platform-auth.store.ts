import { create } from 'zustand';

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PlatformAuthState {
  user: PlatformUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: PlatformUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  initAuth: () => void;
}

export const usePlatformAuthStore = create<PlatformAuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  initAuth: () => {
    const accessToken = localStorage.getItem('platform_accessToken');
    const userStr = localStorage.getItem('platform_user');
    if (accessToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, accessToken, isAuthenticated: true });
      } catch {
        localStorage.removeItem('platform_accessToken');
        localStorage.removeItem('platform_refreshToken');
        localStorage.removeItem('platform_user');
      }
    }
  },

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('platform_accessToken', accessToken);
    localStorage.setItem('platform_refreshToken', refreshToken);
    localStorage.setItem('platform_user', JSON.stringify(user));
    set({ user, accessToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('platform_accessToken');
    localStorage.removeItem('platform_refreshToken');
    localStorage.removeItem('platform_user');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
