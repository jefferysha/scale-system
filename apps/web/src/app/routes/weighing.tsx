import { useEffect, useReducer, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { BalanceStage } from '@/features/weighing/components/BalanceStage';
import { ConfigPanel } from '@/features/weighing/components/ConfigPanel';
import { PendingBanner } from '@/features/weighing/components/PendingBanner';
import { PointGrid } from '@/features/weighing/components/PointGrid';
import { RecordsTable } from '@/features/weighing/components/RecordsTable';
import { ScaleConnectControl } from '@/features/weighing/components/ScaleConnectControl';
import { VerticalLineViz } from '@/features/weighing/components/VerticalLineViz';
import { initialWeighingState, weighingReducer } from '@/features/weighing/machine';
import { hasFullConfig } from '@/features/weighing/machine.guards';
import type { PointPosition, WeighingConfig } from '@/features/weighing/types';
import { useScaleStreamStore } from '@/stores/scale-stream-store';
import { useSubmitRecord } from '@/features/weighing/hooks';
import { isApiError } from '@/lib/api/error';
import type { RecordCreate, RecordPoint } from '@/types/api';

const POSITIONS: PointPosition[] = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

const NEXT_POS: Record<PointPosition, PointPosition | null> = {
  '0.0': '0.2',
  '0.2': '0.4',
  '0.4': '0.6',
  '0.6': '0.8',
  '0.8': '1.0',
  '1.0': null,
};

export default function WeighingPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<Partial<WeighingConfig>>({
    bottle: 1000,
    volume_ml: 500,
    current_pos: '0.0',
  });
  const [state, dispatch] = useReducer(weighingReducer, initialWeighingState);
  const lastWeight = useScaleStreamStore((s) => s.lastWeight);
  const connection = useScaleStreamStore((s) => s.connection);
  const [committedPoints, setCommittedPoints] = useState<RecordPoint[]>([]);
  const [scaleId, setScaleId] = useState<number | null>(null);
  const submitM = useSubmitRecord();

  // 把串口样本桥接到状态机：capturing 期间每个新样本 → WEIGHT_SAMPLE，
  // 到稳态后 reducer 自动切到 ready_to_commit，"录入"按钮启用。
  useEffect(() => {
    if (!lastWeight) return;
    if (state.kind !== 'capturing') return;
    dispatch({ type: 'WEIGHT_SAMPLE', value: lastWeight.value, stable: lastWeight.stable });
  }, [lastWeight, state.kind]);

  // 同步 URL params。
  useEffect(() => {
    const projectId = config.project?.id;
    const verticalId = config.vertical?.id;
    const next = new URLSearchParams(searchParams);
    if (projectId) next.set('project_id', String(projectId));
    else next.delete('project_id');
    if (verticalId) next.set('vertical_id', String(verticalId));
    else next.delete('vertical_id');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.project?.id, config.vertical?.id]);

  const isLive = connection === 'connected' || connection === 'reading';
  const canStart = hasFullConfig(config) && state.kind === 'configured' && isLive;
  const canCommit = state.kind === 'ready_to_commit';

  const onStart = (): void => {
    if (!hasFullConfig(config)) return;
    if (!isLive) {
      toast.error('请先在"硬件连接"区域选择天平并连接');
      return;
    }
    dispatch({ type: 'CONFIGURE', config });
    dispatch({ type: 'START_CAPTURE' });
  };

  const buildRecordCreate = (cfg: WeighingConfig, allPoints: RecordPoint[]): RecordCreate => ({
    client_uid: uuidv4(),
    project_id: cfg.project!.id,
    vertical_id: cfg.vertical!.id,
    tide_type: cfg.tide_type ?? null,
    sample_date: new Date().toISOString().slice(0, 10),
    water_depth_m: cfg.water_depth_m ?? null,
    start_time: cfg.start_time ?? null,
    end_time: null,
    volume_ml: cfg.volume_ml,
    points: allPoints,
    notes: null,
  });

  const onCommit = async (): Promise<void> => {
    if (state.kind !== 'ready_to_commit') return;
    if (!hasFullConfig(config)) return;
    const cfg: WeighingConfig = config;
    const cup = cfg.current_cup!;
    const point: RecordPoint = {
      pos: cfg.current_pos,
      cup_id: cup.id,
      cup_number: cup.cup_number,
      cup_tare_g: cup.current_tare_g,
      wet_weight_g: state.finalValue,
      weighed_at: new Date().toISOString(),
    };
    const next = [...committedPoints, point];
    setCommittedPoints(next);
    dispatch({ type: 'COMMIT' });

    const nextPos = NEXT_POS[cfg.current_pos];
    if (nextPos) {
      // 中间点位：本地缓存即可，等 1.0 完成后整条提交。
      dispatch({ type: 'RESET_FOR_NEXT_POINT', nextPos });
      setConfig({ ...config, current_pos: nextPos });
      return;
    }

    // 6 点完成 → 提交整条 record。
    const payload = buildRecordCreate(cfg, next);
    try {
      await submitM.mutateAsync(payload);
      toast.success('记录已入库');
      setCommittedPoints([]);
      dispatch({ type: 'RESET_FOR_NEXT_POINT', nextPos: '0.0' });
      setConfig({ ...config, current_pos: '0.0' });
    } catch (e) {
      toast.error(isApiError(e) ? e.message : '入库失败（已写入待同步队列）');
    }
  };

  const filter = {
    project_id: config.project?.id,
    vertical_id: config.vertical?.id,
  };
  const committedPositions = new Set(committedPoints.map((p) => p.pos));

  return (
    <div className="grid h-full grid-cols-1 gap-2 p-2 lg:grid-cols-[1fr_1.15fr_0.78fr]">
      <div className="flex min-h-0 flex-col gap-2">
        <PendingBanner />
        <RecordsTable filter={filter} />
      </div>
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
      <div className="flex flex-col gap-2">
        <ScaleConnectControl scaleId={scaleId} onScaleChange={setScaleId} />
        <ConfigPanel
          config={config}
          onChange={(cfg) => {
            setConfig(cfg);
            if (hasFullConfig(cfg)) dispatch({ type: 'CONFIGURE', config: cfg });
          }}
          onStart={onStart}
          onCommit={() => {
            void onCommit();
          }}
          canStart={canStart}
          canCommit={canCommit}
        />
      </div>
    </div>
  );
}
