import { api } from '@/lib/api/client';
import type {
  Cup,
  CupCalibration,
  CupCalibrationCreate,
  CupCreate,
  CupUpdate,
  OffsetPageCup,
} from '@/types/api';

interface ListParams {
  q?: string;
  is_active?: boolean;
  page?: number;
  size?: number;
}

export const cupsApi = {
  list: async (params: ListParams = {}): Promise<OffsetPageCup> =>
    (await api.get<OffsetPageCup>('/cups', { params })).data,
  get: async (id: number): Promise<Cup> => (await api.get<Cup>(`/cups/${id}`)).data,
  create: async (body: CupCreate): Promise<Cup> => (await api.post<Cup>('/cups', body)).data,
  update: async (id: number, body: CupUpdate): Promise<Cup> =>
    (await api.put<Cup>(`/cups/${id}`, body)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/cups/${id}`);
  },
  calibrate: async (id: number, body: CupCalibrationCreate): Promise<CupCalibration> =>
    (await api.post<CupCalibration>(`/cups/${id}/calibrate`, body)).data,
  listCalibrations: async (id: number): Promise<CupCalibration[]> =>
    (await api.get<CupCalibration[]>(`/cups/${id}/calibrations`)).data,
};
