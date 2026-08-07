import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/apiClient';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  setup: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  checkSetup: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      token: null,
      loading: false,
      needsSetup: false,

      login: async (email: string, password: string) => {
        set({ loading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user } = res.data;
          // Set token in axios defaults
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, loading: false, needsSetup: false });
        } catch (error: any) {
          set({ loading: false });
          throw new Error(error.response?.data?.error || '登录失败');
        }
      },

      setup: async (email: string, name: string, password: string) => {
        set({ loading: true });
        try {
          const res = await api.post('/auth/setup', { email, name, password });
          const { token, user } = res.data;
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, loading: false, needsSetup: false });
        } catch (error: any) {
          set({ loading: false });
          throw new Error(error.response?.data?.error || '初始化失败');
        }
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null });
      },

      checkSetup: async () => {
        try {
          const res = await api.get('/auth/setup');
          set({ needsSetup: res.data.needsSetup });
        } catch {
          set({ needsSetup: false });
        }
      },

      setUser: (user: User) => {
        set({ user });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);
