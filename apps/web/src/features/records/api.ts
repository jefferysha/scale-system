import { api } from '@/lib/api/client';
import type { CursorPageRecord, RecordCreate, RecordItem, RecordUpdate } from '@/types/api';

export interface RecordListParams {
  project_id?: number;
  vertical_id?: number;
  date_from?: string;
  date_to?: string;
  cup_number?: string;
  q?: string;
  limit?: number;
  cursor?: string | null;
}

export interface RecordExportParams {
  project_id?: number;
  vertical_id?: number;
  date_from?: string;
  date_to?: string;
}

export const recordsApi = {
  list: async (params: RecordListParams = {}): Promise<CursorPageRecord> =>
    (await api.get<CursorPageRecord>('/records/', { params })).data,
  get: async (id: number): Promise<RecordItem> =>
    (await api.get<RecordItem>(`/records/${id}`)).data,
  create: async (body: RecordCreate): Promise<RecordItem> =>
    (await api.post<RecordItem>('/records/', body)).data,
  update: async (id: number, body: RecordUpdate): Promise<RecordItem> =>
    (await api.put<RecordItem>(`/records/${id}`, body)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/records/${id}`);
  },
  exportCsv: async (params: RecordExportParams): Promise<Blob> => {
    const r = await api.get<Blob>('/records/export', {
      params,
      responseType: 'blob',
    });
    return r.data;
  },
};
