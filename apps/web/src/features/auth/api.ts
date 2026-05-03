import { api } from '@/lib/api/client';
import type { TokenResponse, User } from './types';

export const login = async (username: string, password: string): Promise<TokenResponse> => {
  const r = await api.post<TokenResponse>('/auth/login', {
    username,
    password,
    client_kind: 'web',
  });
  return r.data;
};

export const refresh = async (): Promise<TokenResponse> => {
  const r = await api.post<TokenResponse>('/auth/refresh', { csrf_token: 'placeholder' });
  return r.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const me = async (): Promise<User> => {
  const r = await api.get<User>('/auth/me');
  return r.data;
};
