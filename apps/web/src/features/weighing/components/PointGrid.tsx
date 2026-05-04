import { cn } from '@/lib/utils';
import type { PointDraft } from '../types';

interface Props {
  /** 当前实时重量（含沙量待 commit 才填） */
  liveWeight: number;
  liveStable: boolean;
  /** 当前选中点位 */
  currentPos: string;
  /** 已录入的点位结果 */
  committedPoints: PointDraft[];
  /** 配置元信息 */
  cupNumber: string | null;
  cupTareG: number | null;
  volumeMl: number;
}

interface Cell {
  label: string;
  value: string;
  unit: string;
  delta: string;
  accent?: boolean;
}

export function PointGrid({
  liveWeight,
  liveStable,
  currentPos,
  cupNumber,
  cupTareG,
  volumeMl,
}: Props): React.ReactElement {
  const sandG = cupTareG !== null ? liveWeight - cupTareG : null;
  const liveConcMgL = sandG !== null && volumeMl > 0 ? (sandG / volumeMl) * 1000 : null;

  const cells: Cell[] = [
    {
      label: '天平数据',
      value: liveWeight.toFixed(4),
      unit: 'g',
      delta: liveStable ? '稳定' : '采集中',
      accent: true,
    },
    { label: '杯号', value: cupNumber ?? '—', unit: '', delta: `当前 ${currentPos}` },
    {
      label: '杯沙重',
      value: liveWeight.toFixed(4),
      unit: 'g',
      delta: '湿重',
    },
    {
      label: '杯重',
      value: cupTareG !== null ? cupTareG.toFixed(4) : '0.0000',
      unit: 'g',
      delta: '来自杯重本',
    },
    {
      label: '泥沙重',
      value: sandG !== null ? sandG.toFixed(4) : '0.0000',
      unit: 'g',
      delta: '杯沙重 减 杯重',
    },
    {
      label: '含沙量',
      value: liveConcMgL !== null ? liveConcMgL.toFixed(1) : '0.0',
      unit: 'mg/L',
      delta: '泥沙重 除 容积',
      accent: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className={cn(
            'flex min-w-0 flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2',
            c.accent && 'border-[var(--acc)]/40 bg-[var(--acc-shade)]',
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">
            {c.label}
          </span>
          <span className="flex items-baseline gap-1 font-mono tabular-nums text-[var(--text)]">
            <span className="text-sm">{c.value}</span>
            {c.unit && <span className="text-[10px] text-[var(--text-2)]">{c.unit}</span>}
          </span>
          <span className="truncate text-[10px] text-[var(--text-3)]">{c.delta}</span>
        </div>
      ))}
    </div>
  );
}
