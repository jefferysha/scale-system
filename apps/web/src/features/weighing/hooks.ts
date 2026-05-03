import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { weighingApi } from './api';

export const weighingKeys = {
  records: (filter: { project_id?: number; vertical_id?: number }) =>
    ['records', 'weighing', filter] as const,
};

export const useWeighingRecordsLive = (filter: {
  project_id?: number;
  vertical_id?: number;
}) =>
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

export const useSubmitRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: weighingApi.submitRecord,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['records'] });
    },
  });
};
