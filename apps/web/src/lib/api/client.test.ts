import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server as globalServer } from '@/test/msw-server';
import { api, setAccessToken, setRefreshFn } from './client';
import { ApiError } from './error';

// 复用全局 MSW server，避免双 server 同时拦截同一 URL 造成请求被双重处理。
const server = globalServer;

describe('api client', () => {
  beforeAll(() => {
    // 全局 setup 已 listen；这里不重复 listen。
  });
  afterEach(() => {
    server.resetHandlers();
    setAccessToken(null);
    setRefreshFn(null);
  });
  afterAll(() => {
    // 由全局 setup 的 afterAll 关闭。
  });

  it('attaches bearer token when set', async () => {
    let captured = '';
    server.use(
      http.get('http://localhost:54321/api/v1/me', ({ request }) => {
        captured = request.headers.get('Authorization') ?? '';
        return HttpResponse.json({ ok: true });
      }),
    );
    setAccessToken('abc');
    api.defaults.baseURL = 'http://localhost:54321/api/v1';
    await api.get('/me');
    expect(captured).toBe('Bearer abc');
  });

  it('throws ApiError on 4xx', async () => {
    server.use(
      http.get('http://localhost:54321/api/v1/x', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: '不存在', details: {} } },
          { status: 404 },
        ),
      ),
    );
    api.defaults.baseURL = 'http://localhost:54321/api/v1';
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes token on 401 then retries the original request', async () => {
    let calls = 0;
    server.use(
      http.post('http://localhost:54321/api/v1/auth/refresh', () =>
        HttpResponse.json({ access_token: 'new', user: { id: 1 } }),
      ),
      http.get('http://localhost:54321/api/v1/secure', ({ request }) => {
        calls += 1;
        const auth = request.headers.get('Authorization');
        if (auth !== 'Bearer new') {
          return HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'expired', details: {} } },
            { status: 401 },
          );
        }
        return HttpResponse.json({ ok: true });
      }),
    );
    setAccessToken('stale');
    setRefreshFn(async () => 'new');
    api.defaults.baseURL = 'http://localhost:54321/api/v1';
    const r = await api.get('/secure');
    expect(r.data).toEqual({ ok: true });
    expect(calls).toBe(2);
  });
});
