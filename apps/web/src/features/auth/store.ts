import { create } from 'zustand';
import { setAccessToken, setRefreshFn } from '@/lib/api/client';
import type { User } from './types';
import { refresh as apiRefresh } from './api';

interface AuthState {
  user: User | null;
  isAuthenticating: boolean;
  setUser: (u: User | null) => void;
  applyToken: (token: string, user: User) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticating: false,
  setUser: (u) => set({ user: u }),
  applyToken: (token, user) => {
    setAccessToken(token);
    set({ user });
  },
  reset: () => {
    setAccessToken(null);
    set({ user: null });
  },
}));

// 注入 refresh 函数到 axios 拦截器
setRefreshFn(async () => {
  try {
    const r = await apiRefresh();
    useAuthStore.getState().applyToken(r.access_token, r.user);
    return r.access_token;
  } catch {
    useAuthStore.getState().reset();
    return null;
  }
});
