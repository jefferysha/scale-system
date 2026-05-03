import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { server, TEST_API_BASE_URL } from '@/test/msw-server';
import { fxRecord } from '@/test/fixtures';
import { useDeleteRecord, useExportRecords, useRecordsInfinite } from './hooks';

const wrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };

const newQc = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

describe('records hooks', () => {
  it('useRecordsInfinite 携带 project_id + cursor 参数', async () => {
    let captured = '';
    server.use(
      http.get(`${TEST_API_BASE_URL}/records/`, ({ request }) => {
        captured = new URL(request.url).search;
        return HttpResponse.json({ items: [fxRecord], next_cursor: null });
      }),
    );
    const qc = newQc();
    const { result } = renderHook(
      () => useRecordsInfinite({ project_id: 1, vertical_id: 11, limit: 10 }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured).toContain('project_id=1');
    expect(captured).toContain('vertical_id=11');
    expect(captured).toContain('limit=10');
  });

  it('useDeleteRecord 成功后 invalidate', async () => {
    server.use(
      http.delete(`${TEST_API_BASE_URL}/records/100`, () => new HttpResponse(null, { status: 204 })),
    );
    const qc = newQc();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteRecord(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync(100);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['records'] });
  });

  it('useExportRecords 触发 GET /records/export', async () => {
    let called = false;
    server.use(
      http.get(`${TEST_API_BASE_URL}/records/export`, () => {
        called = true;
        return new HttpResponse('a,b\n1,2', {
          headers: { 'content-type': 'text/csv' },
        });
      }),
    );
    const qc = newQc();
    const { result } = renderHook(() => useExportRecords(), { wrapper: wrapper(qc) });
    const blob = await result.current.mutateAsync({ project_id: 1 });
    expect(called).toBe(true);
    expect(blob).toBeInstanceOf(Blob);
  });
});
