import type { Cup, CupCalibration, Project, RecordItem, Scale, Vertical } from '@/types/api';

export const fxProject: Project = {
  id: 1,
  name: 'S徐六泾断面定线比测202603',
  established_date: '2026-03-01',
  notes: null,
  is_active: true,
  created_at: '2026-05-03T00:00:00Z',
  updated_at: '2026-05-03T00:00:00Z',
};

export const fxVertical: Vertical = {
  id: 11,
  project_id: 1,
  code: 'V-01',
  label: '徐六泾左岸',
  sort_order: 1,
  created_at: '2026-05-03T00:00:00Z',
  updated_at: '2026-05-03T00:00:00Z',
};

export const fxScale: Scale = {
  id: 1,
  name: 'XS204',
  model: 'Mettler XS204',
  protocol_type: 'mettler',
  baud_rate: 9600,
  data_bits: 8,
  parity: 'none',
  stop_bits: 1,
  flow_control: 'none',
  read_timeout_ms: 1000,
  decimal_places: 4,
  unit_default: 'g',
  notes: null,
  is_active: true,
  created_at: '2026-05-03T00:00:00Z',
  updated_at: '2026-05-03T00:00:00Z',
};

export const fxCup: Cup = {
  id: 1024,
  cup_number: 'C-1024',
  current_tare_g: '35.2480',
  latest_calibration_date: '2025-08-01',
  is_active: true,
  notes: null,
  created_at: '2026-05-03T00:00:00Z',
  updated_at: '2026-05-03T00:00:00Z',
};

export const fxCupCalibration: CupCalibration = {
  id: 1,
  cup_id: 1024,
  tare_g: '35.2480',
  calibrated_at: '2025-08-01T08:00:00Z',
  calibrated_by: 1,
  method: '6 次称重平均',
  notes: null,
};

export const fxRecord: RecordItem = {
  id: 100,
  client_uid: '11111111-1111-4111-8111-111111111111',
  project_id: 1,
  vertical_id: 11,
  tide_type: '大潮',
  sample_date: '2026-05-03',
  water_depth_m: '9.40',
  start_time: null,
  end_time: null,
  volume_ml: '500',
  points: [],
  computed_avg_concentration: '0.3349',
  notes: null,
  operator_id: 1,
  source: 'web',
  created_at: '2026-05-03T01:00:00Z',
  updated_at: '2026-05-03T01:00:00Z',
};
