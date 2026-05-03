import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ProjectUpdate } from '@/types/api';
import { projectsApi } from './api';

export const projectsKeys = {
  all: ['projects'] as const,
  list: (params: Record<string, unknown>) => ['projects', 'list', params] as const,
  detail: (id: number) => ['projects', 'detail', id] as const,
  verticals: (projectId: number) => ['projects', projectId, 'verticals'] as const,
};

export const useProjectsInfinite = (
  params: { q?: string; is_active?: boolean; limit?: number } = {},
) =>
  useInfiniteQuery({
    queryKey: projectsKeys.list(params),
    queryFn: ({ pageParam }) =>
      projectsApi.list({ ...params, cursor: pageParam ?? null, limit: params.limit ?? 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProjectUpdate }) =>
      projectsApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
};

export const useVerticalsByProject = (projectId: number | null | undefined) =>
  useQuery({
    queryKey: projectsKeys.verticals(projectId ?? 0),
    queryFn: () => projectsApi.listVerticals(projectId!),
    enabled: typeof projectId === 'number' && projectId > 0,
  });
