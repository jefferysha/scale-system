import { cn } from '@/lib/utils';
import type { PointDraft } from '../types';

interface Props {
  liveWeight: number;
  liveStable: boolean;
  currentPos: string;
  committedPoints: PointDraft[];
  cupNumber: string | null;
  cupTareG: number | null;
  volumeMl: number;
}

interface Cell {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  accent?: boolean;
}

/**
 * 复刻原型 .acquire-grid + .f-cell：3x2 网格无圆角分隔单元，
 * accent 单元用左侧 2px 主色光柱突出"实时值"和"含沙量"。
 */
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
    { label: '杯号', value: cupNumber ?? '—', delta: `当前 ${currentPos}` },
    { label: '杯沙重', value: liveWeight.toFixed(4), unit: 'g', delta: '湿重' },
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
    <div className="grid grid-cols-3 border-y border-[var(--line)]">
      {cells.map((c, i) => {
        const isLastCol = (i + 1) % 3 === 0;
        const isLastRow = i >= cells.length - 3;
        return (
          <div
            key={c.label}
            className={cn(
              'relative flex min-w-0 flex-col gap-0.5 px-2 py-1.5',
              !isLastCol && 'border-r border-[var(--line)]',
              !isLastRow && 'border-b border-[var(--line)]',
            )}
          >
            {c.accent ? (
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--acc)]"
                style={{ boxShadow: '0 0 8px var(--acc)' }}
              />
            ) : null}
            <span className="overflow-hidden truncate text-ellipsis text-[9.5px] tracking-[0.04em] text-[var(--text-3)]">
              {c.label}
            </span>
            <span
              className={cn(
                'flex items-baseline gap-0.5 overflow-hidden truncate font-mono tabular-nums text-[13px] font-semibold leading-none',
                c.accent ? 'text-[var(--acc)]' : 'text-[var(--text)]',
              )}
              data-num
            >
              <span className="truncate">{c.value}</span>
              {c.unit ? (
                <span className="ml-0.5 text-[9px] font-normal text-[var(--text-3)]">{c.unit}</span>
              ) : null}
            </span>
            <span className="overflow-hidden truncate text-ellipsis text-[9px] text-[var(--text-3)]">
              {c.delta}
            </span>
          </div>
        );
      })}
    </div>
  );
}
