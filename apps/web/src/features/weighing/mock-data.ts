import type { CupLite, ProjectLite, VerticalLite } from './types';

export const MOCK_PROJECTS: ProjectLite[] = [
  { id: 1, name: 'S徐六泾断面定线比测202603', established_date: '2026-03-01' },
  { id: 2, name: 'S浙江201611', established_date: '2016-11-13' },
  { id: 3, name: 'S徐六泾断面200712', established_date: '2007-12-24' },
];

export const MOCK_VERTICALS: VerticalLite[] = [
  { id: 1, project_id: 1, code: 'V-01', label: '徐六泾左岸' },
  { id: 2, project_id: 1, code: 'V-02', label: null },
  { id: 3, project_id: 1, code: 'V-03', label: null },
  { id: 4, project_id: 1, code: 'V-04', label: null },
  { id: 5, project_id: 1, code: 'V-05', label: '徐六泾右岸' },
];

export const MOCK_CUPS: CupLite[] = [
  { id: 1024, cup_number: 'C-1024', current_tare_g: 35.248 },
  { id: 1025, cup_number: 'C-1025', current_tare_g: 35.671 },
  { id: 325, cup_number: '325', current_tare_g: 50.6112 },
];

export interface MockRecordPoint {
  pos: string;
  cup_number: string;
  wet_weight_g: number;
  concentration_mg_l: number;
}

export interface MockRecord {
  id: number;
  project_id: number;
  vertical_id: number;
  sample_date: string;
  water_depth_m: number;
  points: MockRecordPoint[];
  computed_avg_concentration: number;
}

export const MOCK_RECORDS: MockRecord[] = [
  {
    id: 1,
    project_id: 1,
    vertical_id: 1,
    sample_date: '2026-05-02',
    water_depth_m: 9.4,
    points: [
      { pos: '0.0', cup_number: '325', wet_weight_g: 45.1008, concentration_mg_l: 0.3109 },
      { pos: '0.2', cup_number: '207', wet_weight_g: 70.0226, concentration_mg_l: 0.3384 },
      { pos: '0.4', cup_number: '219', wet_weight_g: 51.0602, concentration_mg_l: 0.3281 },
      { pos: '0.6', cup_number: '564', wet_weight_g: 47.7411, concentration_mg_l: 0.3226 },
      { pos: '0.8', cup_number: '339', wet_weight_g: 49.7393, concentration_mg_l: 0.3578 },
      { pos: '1.0', cup_number: '333', wet_weight_g: 50.611, concentration_mg_l: 0.3516 },
    ],
    computed_avg_concentration: 0.3349,
  },
];
