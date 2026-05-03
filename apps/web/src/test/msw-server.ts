import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const TEST_API_BASE_URL = 'http://localhost:54321/api/v1';

export const server = setupServer(
  http.get(`${TEST_API_BASE_URL}/auth/me`, () =>
    HttpResponse.json({
      id: 1,
      username: 'tester',
      email: null,
      role: 'admin',
      is_active: true,
      created_at: '2026-05-03T00:00:00Z',
      updated_at: '2026-05-03T00:00:00Z',
    }),
  ),
  http.get(`${TEST_API_BASE_URL}/projects`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${TEST_API_BASE_URL}/scales`, () => HttpResponse.json([])),
  http.get(`${TEST_API_BASE_URL}/cups`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, size: 50 }),
  ),
  http.get(`${TEST_API_BASE_URL}/records/`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
);
