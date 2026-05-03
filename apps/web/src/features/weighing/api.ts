import { api } from '@/lib/api/client';
import type {
  CursorPageRecord,
  RecordCreate,
  RecordItem,
} from '@/types/api';

export interface WeighingFilterParams {
  project_id?: number;
  vertical_id?: number;
  date_from?: string;
  date_to?: string;
  cursor?: string | null;
  limit?: number;
}

export const weighingApi = {
  submitRecord: async (body: RecordCreate): Promise<RecordItem> =>
    (await api.post<RecordItem>('/records/', body)).data,
  fetchRecordsByFilter: async (
    params: WeighingFilterParams,
  ): Promise<CursorPageRecord> =>
    (await api.get<CursorPageRecord>('/records/', { params })).data,
};
