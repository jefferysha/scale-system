import { useEffect } from 'react';
import { BalanceImage } from './BalanceImage';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
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
    <section className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[var(--bg-2)] p-3">
      <header className="flex items-center justify-between pb-1">
        <ConnectionStatusBadge state={connection} />
        <span
          className="font-mono text-[10px] tracking-wider text-[var(--text-3)]"
          data-testid="samples-per-sec"
        >
          {samplesPerSec} sps
        </span>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <BalanceImage digits={digits} stable={stable} />
      </div>
    </section>
  );
}
