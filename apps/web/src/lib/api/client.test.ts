import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { api, setAccessToken, setRefreshFn } from './client';
import { ApiError } from './error';

const server = setupServer();

describe('api client', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    setAccessToken(null);
    setRefreshFn(null);
  });
  afterAll(() => server.close());

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
