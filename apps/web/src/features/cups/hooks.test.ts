import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { server, TEST_API_BASE_URL } from '@/test/msw-server';
import { fxCup, fxCupCalibration } from '@/test/fixtures';
import {
  useCalibrateCup,
  useCalibrations,
  useCreateCup,
  useCups,
} from './hooks';

const wrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };

const newQc = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

describe('cups hooks', () => {
  it('useCups 返回 offset 分页', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/cups`, () =>
        HttpResponse.json({ items: [fxCup], total: 1, page: 1, size: 50 }),
      ),
    );
    const qc = newQc();
    const { result } = renderHook(() => useCups(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
  });

  it('useCreateCup 成功后 invalidate', async () => {
    server.use(http.post(`${TEST_API_BASE_URL}/cups`, () => HttpResponse.json(fxCup)));
    const qc = newQc();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateCup(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({
      cup_number: 'C-X',
      current_tare_g: 35.0,
      is_active: true,
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cups'] });
  });

  it('useCalibrateCup 成功后 invalidate cup + calibrations', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/cups/1024/calibrate`, () =>
        HttpResponse.json(fxCupCalibration),
      ),
    );
    const qc = newQc();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCalibrateCup(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ id: 1024, body: { tare_g: 35.0 } });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cups'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cup-calibrations', 1024] });
  });

  it('useCalibrations 拉取列表', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/cups/1024/calibrations`, () =>
        HttpResponse.json([fxCupCalibration]),
      ),
    );
    const qc = newQc();
    const { result } = renderHook(() => useCalibrations(1024), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe(fxCupCalibration.id);
  });
});
