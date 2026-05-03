import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CupCalibrationCreate, CupUpdate } from '@/types/api';
import { cupsApi } from './api';

export const cupsKeys = {
  all: ['cups'] as const,
  list: (params: Record<string, unknown>) => ['cups', 'list', params] as const,
  detail: (id: number) => ['cups', 'detail', id] as const,
  calibrations: (id: number) => ['cup-calibrations', id] as const,
};

export const useCups = (
  params: { q?: string; is_active?: boolean; page?: number; size?: number } = {},
) =>
  useQuery({
    queryKey: cupsKeys.list(params),
    queryFn: () => cupsApi.list(params),
    placeholderData: (prev) => prev,
  });

export const useCreateCup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cupsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cupsKeys.all });
    },
  });
};

export const useUpdateCup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CupUpdate }) => cupsApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cupsKeys.all });
    },
  });
};

export const useDeleteCup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cupsApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cupsKeys.all });
    },
  });
};

export const useCalibrateCup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CupCalibrationCreate }) =>
      cupsApi.calibrate(id, body),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: cupsKeys.all });
      void qc.invalidateQueries({ queryKey: cupsKeys.calibrations(variables.id) });
    },
  });
};

export const useCalibrations = (cupId: number | null | undefined) =>
  useQuery({
    queryKey: cupsKeys.calibrations(cupId ?? 0),
    queryFn: () => cupsApi.listCalibrations(cupId!),
    enabled: typeof cupId === 'number' && cupId > 0,
  });
