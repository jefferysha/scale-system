import type { WeighingEvent, WeighingState } from './machine.events';
import { isStable } from './machine.guards';
import type { WeighingConfig } from './types';

export function weighingReducer(state: WeighingState, event: WeighingEvent): WeighingState {
  switch (event.type) {
    case 'CONFIGURE':
      return { kind: 'configured', config: event.config };

    case 'START_CAPTURE':
      if (state.kind !== 'configured') return state;
      return {
        kind: 'capturing',
        config: state.config,
        samples: 0,
        lastValue: 0,
        stable: false,
      };

    case 'WEIGHT_SAMPLE': {
      if (state.kind !== 'capturing') return state;
      const samples = state.samples + 1;
      if (isStable(samples, event.stable)) {
        return { kind: 'ready_to_commit', config: state.config, finalValue: event.value };
      }
      return {
        kind: 'capturing',
        config: state.config,
        samples,
        lastValue: event.value,
        stable: event.stable,
      };
    }

    case 'COMMIT':
      if (state.kind !== 'ready_to_commit') return state;
      return {
        kind: 'committed',
        config: state.config,
        pos: state.config.current_pos,
        finalValue: state.finalValue,
      };

    case 'RESET_FOR_NEXT_POINT': {
      if (state.kind === 'idle') return state;
      const nextConfig: WeighingConfig = { ...state.config, current_pos: event.nextPos };
      return { kind: 'configured', config: nextConfig };
    }

    case 'ABORT':
      return { kind: 'idle' };
  }
}

export const initialWeighingState: WeighingState = { kind: 'idle' };
