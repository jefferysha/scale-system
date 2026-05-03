import type { PointPosition, WeighingConfig } from './types';

export type WeighingState =
  | { kind: 'idle' }
  | { kind: 'configured'; config: WeighingConfig }
  | { kind: 'capturing'; config: WeighingConfig; samples: number; lastValue: number; stable: boolean }
  | { kind: 'ready_to_commit'; config: WeighingConfig; finalValue: number }
  | { kind: 'committed'; config: WeighingConfig; pos: PointPosition; finalValue: number };

export type WeighingEvent =
  | { type: 'CONFIGURE'; config: WeighingConfig }
  | { type: 'START_CAPTURE' }
  | { type: 'WEIGHT_SAMPLE'; value: number; stable: boolean }
  | { type: 'COMMIT' }
  | { type: 'RESET_FOR_NEXT_POINT'; nextPos: PointPosition }
  | { type: 'ABORT' };

export const STABLE_REQUIRED_SAMPLES = 5;
