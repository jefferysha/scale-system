import { describe, expect, it } from 'vitest';
import { initialWeighingState, weighingReducer } from './machine';
import type { WeighingState } from './machine.events';
import { hasFullConfig, isStable } from './machine.guards';
import type { WeighingConfig } from './types';

const cfg: WeighingConfig = {
  project: { id: 1, name: 'P', established_date: null },
  vertical: { id: 1, project_id: 1, code: 'V', label: null },
  bottle: 1000,
  volume_ml: 500,
  water_depth_m: 9.4,
  tide_type: null,
  start_time: null,
  current_pos: '0.0',
  current_cup: { id: 1, cup_number: 'C', current_tare_g: 35.0 },
  target_wet_weight_g: 100,
};

describe('weighingReducer', () => {
  it('starts idle', () => {
    expect(initialWeighingState.kind).toBe('idle');
  });

  it('CONFIGURE → configured', () => {
    const s = weighingReducer(initialWeighingState, { type: 'CONFIGURE', config: cfg });
    expect(s.kind).toBe('configured');
  });

  it('START_CAPTURE only from configured', () => {
    const s1 = weighingReducer(initialWeighingState, { type: 'START_CAPTURE' });
    expect(s1.kind).toBe('idle');
    const s2 = weighingReducer({ kind: 'configured', config: cfg }, { type: 'START_CAPTURE' });
    expect(s2.kind).toBe('capturing');
  });

  it('5 stable samples → ready_to_commit', () => {
    let s: WeighingState = { kind: 'capturing', config: cfg, samples: 0, lastValue: 0, stable: false };
    for (let i = 0; i < 5; i++) {
      s = weighingReducer(s, { type: 'WEIGHT_SAMPLE', value: 99.9999, stable: true });
    }
    expect(s.kind).toBe('ready_to_commit');
  });

  it('unstable samples stay in capturing', () => {
    let s: WeighingState = { kind: 'capturing', config: cfg, samples: 0, lastValue: 0, stable: false };
    for (let i = 0; i < 10; i++) {
      s = weighingReducer(s, { type: 'WEIGHT_SAMPLE', value: 99.9, stable: false });
    }
    expect(s.kind).toBe('capturing');
    if (s.kind === 'capturing') {
      expect(s.samples).toBe(10);
    }
  });

  it('COMMIT requires ready_to_commit', () => {
    const s1 = weighingReducer({ kind: 'configured', config: cfg }, { type: 'COMMIT' });
    expect(s1.kind).toBe('configured');
    const s2 = weighingReducer({ kind: 'ready_to_commit', config: cfg, finalValue: 100 }, { type: 'COMMIT' });
    expect(s2.kind).toBe('committed');
  });

  it('RESET_FOR_NEXT_POINT moves to configured with new pos', () => {
    const s = weighingReducer(
      { kind: 'committed', config: cfg, pos: '0.0', finalValue: 100 },
      { type: 'RESET_FOR_NEXT_POINT', nextPos: '0.2' },
    );
    expect(s.kind).toBe('configured');
    if (s.kind === 'configured') {
      expect(s.config.current_pos).toBe('0.2');
    }
  });

  it('ABORT returns to idle', () => {
    const s = weighingReducer({ kind: 'configured', config: cfg }, { type: 'ABORT' });
    expect(s.kind).toBe('idle');
  });

  it('WEIGHT_SAMPLE outside capturing is no-op', () => {
    const s = weighingReducer({ kind: 'configured', config: cfg }, {
      type: 'WEIGHT_SAMPLE', value: 1, stable: true,
    });
    expect(s.kind).toBe('configured');
  });

  it('RESET_FOR_NEXT_POINT from idle is no-op', () => {
    const s = weighingReducer(initialWeighingState, {
      type: 'RESET_FOR_NEXT_POINT', nextPos: '0.2',
    });
    expect(s.kind).toBe('idle');
  });
});

describe('machine.guards', () => {
  it('hasFullConfig returns false on partial', () => {
    expect(hasFullConfig({})).toBe(false);
    expect(hasFullConfig({ project: cfg.project })).toBe(false);
    expect(hasFullConfig({ ...cfg, current_cup: null })).toBe(false);
  });

  it('hasFullConfig returns true on complete', () => {
    expect(hasFullConfig(cfg)).toBe(true);
  });

  it('isStable requires both stable flag and 5+ samples', () => {
    expect(isStable(4, true)).toBe(false);
    expect(isStable(5, false)).toBe(false);
    expect(isStable(5, true)).toBe(true);
    expect(isStable(10, true)).toBe(true);
  });
});
