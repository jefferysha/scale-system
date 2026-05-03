import { create } from 'zustand';
import type { ConnectionState, WeightSample } from '@/lib/serial/adapter';

interface ScaleStreamState {
  connection: ConnectionState;
  lastWeight: WeightSample | null;
  error: { code: string; message: string } | null;
  samplesPerSec: number;
  _samplesIn1s: number;
  _windowStart: number;
  setConnection: (c: ConnectionState) => void;
  pushSample: (s: WeightSample) => void;
  setError: (e: { code: string; message: string } | null) => void;
  reset: () => void;
}

export const useScaleStreamStore = create<ScaleStreamState>((set, get) => ({
  connection: 'idle',
  lastWeight: null,
  error: null,
  samplesPerSec: 0,
  _samplesIn1s: 0,
  _windowStart: Date.now(),
  setConnection: (c) => set({ connection: c }),
  pushSample: (s) => {
    const now = Date.now();
    const st = get();
    let inWin = st._samplesIn1s + 1;
    let winStart = st._windowStart;
    if (now - winStart >= 1000) {
      const sps = inWin;
      inWin = 0;
      winStart = now;
      set({ samplesPerSec: sps });
    }
    set({ lastWeight: s, _samplesIn1s: inWin, _windowStart: winStart });
  },
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      connection: 'idle',
      lastWeight: null,
      error: null,
      samplesPerSec: 0,
      _samplesIn1s: 0,
      _windowStart: Date.now(),
    }),
}));
