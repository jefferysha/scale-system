import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, type ApiErrorBody } from './error';

const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
type RefreshFn = () => Promise<string | null>;
let refreshFn: RefreshFn | null = null;

export const setAccessToken = (t: string | null): void => {
  accessToken = t;
};
export const getAccessToken = (): string | null => accessToken;
export const setRefreshFn = (fn: RefreshFn | null): void => {
  refreshFn = fn;
};

const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (accessToken) cfg.headers.set('Authorization', `Bearer ${accessToken}`);
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original?._retried && refreshFn) {
      original._retried = true;
      refreshing ??= refreshFn();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        accessToken = newToken;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }
    if (err.response?.data?.error) {
      throw new ApiError(err.response.status, err.response.data.error as ApiErrorBody);
    }
    throw err;
  },
);

export { api };
