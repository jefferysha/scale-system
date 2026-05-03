import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { server, TEST_API_BASE_URL } from '@/test/msw-server';
import { fxScale } from '@/test/fixtures';
import { useCreateScale, useReportProbe, useScales } from './hooks';

const wrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };

const newQc = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

describe('scales hooks', () => {
  it('useScales 返回列表', async () => {
    server.use(http.get(`${TEST_API_BASE_URL}/scales`, () => HttpResponse.json([fxScale])));
    const qc = newQc();
    const { result } = renderHook(() => useScales(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe(fxScale.id);
  });

  it('useCreateScale 成功后 invalidate', async () => {
    server.use(http.post(`${TEST_API_BASE_URL}/scales`, () => HttpResponse.json(fxScale)));
    const qc = newQc();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateScale(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({
      name: 'X',
      protocol_type: 'generic',
      baud_rate: 9600,
      data_bits: 8,
      parity: 'none',
      stop_bits: 1,
      flow_control: 'none',
      read_timeout_ms: 1000,
      decimal_places: 4,
      unit_default: 'g',
      is_active: true,
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['scales'] });
  });

  it('useReportProbe 调 /probe-result', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${TEST_API_BASE_URL}/scales/1/probe-result`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ recorded: true });
      }),
    );
    const qc = newQc();
    const { result } = renderHook(() => useReportProbe(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({
      id: 1,
      body: { ok: true, samples_count: 3, samples: [], error: null },
    });
    expect(captured).toMatchObject({ ok: true, samples_count: 3 });
  });
});
