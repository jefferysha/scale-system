import { create } from 'zustand';
import { setAccessToken, setRefreshFn } from '@/lib/api/client';
import type { User } from './types';
import { refresh as apiRefresh } from './api';

interface AuthState {
  user: User | null;
  /** true: 正在启动时还原 session（refresh cookie 检查中），UI 应显示 loading 而非跳 login */
  isBootstrapping: boolean;
  /** true: 登录或 refresh 进行中（非启动） */
  isAuthenticating: boolean;
  setUser: (u: User | null) => void;
  applyToken: (token: string, user: User) => void;
  setBootstrapping: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapping: true,
  isAuthenticating: false,
  setUser: (u) => set({ user: u }),
  applyToken: (token, user) => {
    setAccessToken(token);
    set({ user });
  },
  setBootstrapping: (v) => set({ isBootstrapping: v }),
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
