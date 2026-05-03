import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScaleProbeReport, ScaleUpdate } from '@/types/api';
import { scalesApi } from './api';

export const scalesKeys = {
  all: ['scales'] as const,
  list: (params: Record<string, unknown>) => ['scales', 'list', params] as const,
  detail: (id: number) => ['scales', 'detail', id] as const,
};

export const useScales = (params: { is_active?: boolean } = {}) =>
  useQuery({
    queryKey: scalesKeys.list(params),
    queryFn: () => scalesApi.list(params),
  });

export const useCreateScale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scalesApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: scalesKeys.all });
    },
  });
};

export const useUpdateScale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ScaleUpdate }) => scalesApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: scalesKeys.all });
    },
  });
};

export const useDeleteScale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scalesApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: scalesKeys.all });
    },
  });
};

export const useReportProbe = () =>
  useMutation({
    mutationFn: ({ id, body }: { id: number; body: ScaleProbeReport }) =>
      scalesApi.reportProbe(id, body),
  });
