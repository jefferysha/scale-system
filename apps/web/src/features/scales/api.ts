import { api } from '@/lib/api/client';
import type {
  Scale,
  ScaleCreate,
  ScaleProbeAck,
  ScaleProbeReport,
  ScaleUpdate,
  ScaleValidateResult,
} from '@/types/api';

export const scalesApi = {
  list: async (params: { is_active?: boolean } = {}): Promise<Scale[]> =>
    (await api.get<Scale[]>('/scales', { params })).data,
  get: async (id: number): Promise<Scale> => (await api.get<Scale>(`/scales/${id}`)).data,
  create: async (body: ScaleCreate): Promise<Scale> =>
    (await api.post<Scale>('/scales', body)).data,
  update: async (id: number, body: ScaleUpdate): Promise<Scale> =>
    (await api.put<Scale>(`/scales/${id}`, body)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/scales/${id}`);
  },
  validate: async (id: number): Promise<ScaleValidateResult> =>
    (await api.post<ScaleValidateResult>(`/scales/${id}/validate`)).data,
  reportProbe: async (id: number, body: ScaleProbeReport): Promise<ScaleProbeAck> =>
    (await api.post<ScaleProbeAck>(`/scales/${id}/probe-result`, body)).data,
};
