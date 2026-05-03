export interface ProjectLite {
  id: number;
  name: string;
  established_date: string | null;
}

export interface VerticalLite {
  id: number;
  project_id: number;
  code: string;
  label: string | null;
}

export interface CupLite {
  id: number;
  cup_number: string;
  current_tare_g: number;
}

export type PointPosition = '0.0' | '0.2' | '0.4' | '0.6' | '0.8' | '1.0';

export interface PointDraft {
  pos: PointPosition;
  cup_id: number | null;
  cup_number: string | null;
  cup_tare_g: number | null;
  wet_weight_g: number | null;
  concentration_mg_l: number | null;
  weighed_at: string | null;
}

export interface WeighingConfig {
  project: ProjectLite | null;
  vertical: VerticalLite | null;
  bottle: 1000 | 500 | 250;
  volume_ml: number;
  water_depth_m: number | null;
  tide_type: '大潮' | '小潮' | '平潮' | null;
  start_time: string | null;
  current_pos: PointPosition;
  current_cup: CupLite | null;
  target_wet_weight_g: number | null;
}
