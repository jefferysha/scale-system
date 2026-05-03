import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecordCreate, RecordItem } from '@/types/api';
import { api } from '@/lib/api/client';
import { getSubmissionQueue } from '@/lib/platform';
import { weighingApi } from './api';

export const weighingKeys = {
  records: (filter: { project_id?: number; vertical_id?: number }) =>
    ['records', 'weighing', filter] as const,
};

export const useWeighingRecordsLive = (filter: { project_id?: number; vertical_id?: number }) =>
  useInfiniteQuery({
    queryKey: weighingKeys.records(filter),
    queryFn: ({ pageParam }) =>
      weighingApi.fetchRecordsByFilter({
        ...filter,
        cursor: pageParam ?? null,
        limit: 50,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
    refetchInterval: 10_000,
    enabled: filter.project_id !== undefined,
  });

/**
 * 录入：先写入 IndexedDB 队列（保证幂等 + 离线可恢复），
 * 然后立刻尝试 POST。失败时由 SyncWorker 周期性重试。
 */
export const useSubmitRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RecordCreate): Promise<RecordItem | null> => {
      const queue = getSubmissionQueue();
      await queue.enqueue({ client_uid: body.client_uid, payload: body });
      try {
        const r = await api.post<RecordItem>('/records/', body);
        await queue.markSynced([body.client_uid]);
        return r.data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'submit failed';
        await queue.markFailed(body.client_uid, msg, 5);
        throw e;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['records'] });
    },
  });
};
