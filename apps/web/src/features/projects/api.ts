import { api } from '@/lib/api/client';
import type {
  CursorPageProject,
  Project,
  ProjectCreate,
  ProjectUpdate,
  Vertical,
  VerticalCreate,
} from '@/types/api';

interface ListParams {
  q?: string;
  is_active?: boolean;
  limit?: number;
  cursor?: string | null;
}

export const projectsApi = {
  list: async (params: ListParams = {}): Promise<CursorPageProject> => {
    const r = await api.get<CursorPageProject>('/projects', { params });
    return r.data;
  },
  get: async (id: number): Promise<Project> => (await api.get<Project>(`/projects/${id}`)).data,
  create: async (body: ProjectCreate): Promise<Project> =>
    (await api.post<Project>('/projects', body)).data,
  update: async (id: number, body: ProjectUpdate): Promise<Project> =>
    (await api.put<Project>(`/projects/${id}`, body)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
  listVerticals: async (projectId: number): Promise<Vertical[]> =>
    (await api.get<Vertical[]>(`/projects/${projectId}/verticals`)).data,
  createVertical: async (projectId: number, body: VerticalCreate): Promise<Vertical> =>
    (await api.post<Vertical>(`/projects/${projectId}/verticals`, body)).data,
};
