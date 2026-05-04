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
    <section
      className="relative flex min-h-0 flex-1 flex-col p-1"
      style={{
        background:
          'radial-gradient(ellipse at 50% 38%, color-mix(in oklab, var(--bg-2) 70%, var(--acc-shade)), transparent 65%)',
      }}
    >
      <ConnectionStatusBadge state={connection} className="absolute left-2 top-2 z-10" />
      <span
        className="absolute right-2 top-2 z-10 font-mono text-[10px] tracking-wider text-[var(--text-3)]"
        data-testid="samples-per-sec"
      >
        {samplesPerSec} sps
      </span>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <BalanceImage digits={digits} stable={stable} />
      </div>
    </section>
  );
}
