import { api } from '@/lib/api/client';
import type { TokenResponse, User } from './types';

/**
 * Web 端 refresh_token 容器：
 * 优先依赖 BE 设置的 HttpOnly cookie（HTTPS 部署用），但因 chrome fetch+CORS+
 * SameSite=Lax 在 localhost 下可能不带 cookie，BE 现在双写：同时把 refresh_token
 * 返回到 body。前端把 body 中的 refresh_token 缓存在内存（不持久化），refresh
 * 调用时优先放进 body 让 BE 走 cookie-fallback 路径。
 */
let refreshTokenMemory: string | null = null;

export const setRefreshToken = (token: string | null): void => {
  refreshTokenMemory = token;
};

export const getRefreshToken = (): string | null => refreshTokenMemory;

export const login = async (username: string, password: string): Promise<TokenResponse> => {
  const r = await api.post<TokenResponse>('/auth/login', {
    username,
    password,
    client_kind: 'web',
  });
  if (r.data.refresh_token) refreshTokenMemory = r.data.refresh_token;
  return r.data;
};

export const refresh = async (): Promise<TokenResponse> => {
  const r = await api.post<TokenResponse>('/auth/refresh', {
    csrf_token: 'placeholder',
    refresh_token: refreshTokenMemory ?? undefined,
    client_kind: 'web',
  });
  if (r.data.refresh_token) refreshTokenMemory = r.data.refresh_token;
  return r.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
  refreshTokenMemory = null;
};

export const me = async (): Promise<User> => {
  const r = await api.get<User>('/auth/me');
  return r.data;
};
