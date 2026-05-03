import { useReducer, useState } from 'react';
import { BalanceStage } from '@/features/weighing/components/BalanceStage';
import { ConfigPanel } from '@/features/weighing/components/ConfigPanel';
import { PointGrid } from '@/features/weighing/components/PointGrid';
import { RecordsTable } from '@/features/weighing/components/RecordsTable';
import { VerticalLineViz } from '@/features/weighing/components/VerticalLineViz';
import { initialWeighingState, weighingReducer } from '@/features/weighing/machine';
import { hasFullConfig } from '@/features/weighing/machine.guards';
import type { PointPosition, WeighingConfig } from '@/features/weighing/types';
import { useScaleStreamStore } from '@/stores/scale-stream-store';
import { getSerialAdapter } from '@/lib/platform';

const POSITIONS: PointPosition[] = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

export default function WeighingPage(): React.ReactElement {
  const [config, setConfig] = useState<Partial<WeighingConfig>>({
    bottle: 1000,
    volume_ml: 500,
    current_pos: '0.0',
  });
  const [state, dispatch] = useReducer(weighingReducer, initialWeighingState);
  const lastWeight = useScaleStreamStore((s) => s.lastWeight);
  const [committedPositions] = useState<Set<string>>(new Set());

  const canStart = hasFullConfig(config) && state.kind === 'configured';
  const canCommit = state.kind === 'ready_to_commit';

  const onStart = async (): Promise<void> => {
    if (!hasFullConfig(config)) return;
    dispatch({ type: 'CONFIGURE', config });
    const adapter = getSerialAdapter();
    if (adapter.isSupported()) {
      await adapter.open('mock-com3', {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: 'none',
        protocolType: 'generic',
        readTimeoutMs: 1000,
        decimalPlaces: 4,
        unitDefault: 'g',
      });
    }
    dispatch({ type: 'START_CAPTURE' });
  };

  const onCommit = (): void => {
    dispatch({ type: 'COMMIT' });
  };

  return (
    <div className="grid h-full grid-cols-[1.7fr_0.92fr_0.42fr] gap-2 p-2">
      <RecordsTable />
      <div className="flex flex-col gap-2">
        <BalanceStage />
        <PointGrid
          liveWeight={lastWeight?.value ?? 0}
          liveStable={lastWeight?.stable ?? false}
          currentPos={config.current_pos ?? '0.0'}
          committedPoints={[]}
          cupNumber={config.current_cup?.cup_number ?? null}
          cupTareG={config.current_cup?.current_tare_g ?? null}
          volumeMl={config.volume_ml ?? 500}
        />
        <VerticalLineViz
          positions={POSITIONS}
          current={config.current_pos ?? '0.0'}
          committed={committedPositions}
          waterDepthM={config.water_depth_m ?? null}
        />
      </div>
      <ConfigPanel
        config={config}
        onChange={(cfg) => {
          setConfig(cfg);
          if (hasFullConfig(cfg)) dispatch({ type: 'CONFIGURE', config: cfg });
        }}
        onStart={() => {
          void onStart();
        }}
        onCommit={onCommit}
        canStart={canStart}
        canCommit={canCommit}
      />
    </div>
  );
}
