import { useEffect } from 'react';
import { BalanceImage } from './BalanceImage';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { SamplesHealthIndicator } from './SamplesHealthIndicator';
import { useScaleStreamStore } from '@/stores/scale-stream-store';
import { getSerialAdapter } from '@/lib/platform';

export function BalanceStage(): React.ReactElement {
  const connection = useScaleStreamStore((s) => s.connection);
  const lastWeight = useScaleStreamStore((s) => s.lastWeight);
  const samplesPerSec = useScaleStreamStore((s) => s.samplesPerSec);
  const setConnection = useScaleStreamStore((s) => s.setConnection);
  const pushSample = useScaleStreamStore((s) => s.pushSample);
  const setError = useScaleStreamStore((s) => s.setError);

  useEffect(() => {
    const adapter = getSerialAdapter();
    const offW = adapter.onWeight(pushSample);
    const offS = adapter.onStatus(setConnection);
    const offE = adapter.onError(setError);
    return () => {
      offW();
      offS();
      offE();
    };
  }, [pushSample, setConnection, setError]);

  const digits = lastWeight ? lastWeight.value.toFixed(4) : '0.0000';
  const stable = lastWeight?.stable ?? false;

  return (
    <section className="relative flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[var(--bg-2)] p-4">
      <header className="flex items-center justify-between">
        <ConnectionStatusBadge state={connection} />
        <span className="text-xs text-[var(--text-3)]">实时</span>
      </header>
      <BalanceImage digits={digits} stable={stable} />
      <footer className="flex justify-end">
        <SamplesHealthIndicator sps={samplesPerSec} />
      </footer>
    </section>
  );
}
