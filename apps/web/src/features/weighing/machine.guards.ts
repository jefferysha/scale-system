import { STABLE_REQUIRED_SAMPLES } from './machine.events';
import type { WeighingConfig } from './types';

export const hasFullConfig = (cfg: Partial<WeighingConfig>): cfg is WeighingConfig => {
  return Boolean(
    cfg.project &&
      cfg.vertical &&
      cfg.bottle &&
      cfg.volume_ml &&
      cfg.current_pos &&
      cfg.current_cup,
  );
};

export const isStable = (samples: number, stable: boolean): boolean => {
  return stable && samples >= STABLE_REQUIRED_SAMPLES;
};
