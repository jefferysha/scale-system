import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecordListParams } from './api';
import { recordsApi } from './api';

export const recordsKeys = {
  all: ['records'] as const,
  list: (params: Record<string, unknown>) => ['records', 'list', params] as const,
  detail: (id: number) => ['records', 'detail', id] as const,
};

export const useRecordsInfinite = (params: RecordListParams) =>
  useInfiniteQuery({
    queryKey: recordsKeys.list(params as Record<string, unknown>),
    queryFn: ({ pageParam }) =>
      recordsApi.list({ ...params, cursor: pageParam ?? null, limit: params.limit ?? 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
  });

export const useDeleteRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recordsApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recordsKeys.all });
    },
  });
};

export const useExportRecords = () =>
  useMutation({
    mutationFn: recordsApi.exportCsv,
  });
