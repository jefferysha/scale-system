import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server, TEST_API_BASE_URL } from '@/test/msw-server';
import { fxProject } from '@/test/fixtures';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { useCreateProject, useProjectsInfinite } from './hooks';

const wrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };

const newQc = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

describe('projects hooks', () => {
  it('useProjectsInfinite 返回空列表（默认 mock）', async () => {
    const qc = newQc();
    const { result } = renderHook(() => useProjectsInfinite(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.items).toEqual([]);
  });

  it('useProjectsInfinite 携带 cursor + limit 参数', async () => {
    let captured = '';
    server.use(
      http.get(`${TEST_API_BASE_URL}/projects`, ({ request }) => {
        captured = new URL(request.url).search;
        return HttpResponse.json({ items: [fxProject], next_cursor: 'next-1' });
      }),
    );
    const qc = newQc();
    const { result } = renderHook(() => useProjectsInfinite({ q: 'foo', limit: 5 }), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured).toContain('q=foo');
    expect(captured).toContain('limit=5');
    expect(result.current.data?.pages[0]?.items[0]?.id).toBe(fxProject.id);
  });

  it('useCreateProject 成功后 invalidate 列表查询', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/projects`, async () => HttpResponse.json(fxProject)),
    );
    const qc = newQc();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateProject(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({
      name: 'X',
      established_date: null,
      notes: null,
      is_active: true,
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });
});
