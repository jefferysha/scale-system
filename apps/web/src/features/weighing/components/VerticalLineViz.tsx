import { cn } from '@/lib/utils';

interface Props {
  positions: string[];
  current: string;
  committed: Set<string>;
  waterDepthM: number | null;
}

export function VerticalLineViz({
  positions,
  current,
  committed,
  waterDepthM,
}: Props): React.ReactElement {
  const W = 560;
  const H = 200;
  const pad = 30;
  const xCenter = W / 2;
  const top = pad;
  const bottom = H - pad;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-2">
      <header className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-[var(--text-2)]">垂线示意图</span>
        <span className="font-mono text-[10px] text-[var(--text-3)]">
          六点位 0.0 → 1.0 · 水深 {waterDepthM ?? '—'} m
        </span>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full">
        <line
          x1={xCenter}
          y1={top}
          x2={xCenter}
          y2={bottom}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={2}
        />
        <line
          x1={xCenter - 60}
          y1={top}
          x2={xCenter + 60}
          y2={top}
          stroke="var(--info)"
          strokeWidth={1.5}
        />
        <text
          x={xCenter + 70}
          y={top + 4}
          fill="var(--text-3)"
          fontSize="10"
          fontFamily="monospace"
        >
          水面
        </text>
        <line
          x1={xCenter - 60}
          y1={bottom}
          x2={xCenter + 60}
          y2={bottom}
          stroke="var(--warn)"
          strokeWidth={1.5}
        />
        <text
          x={xCenter + 70}
          y={bottom + 4}
          fill="var(--text-3)"
          fontSize="10"
          fontFamily="monospace"
        >
          河床
        </text>
        {positions.map((p, i) => {
          const y = top + ((bottom - top) * i) / (positions.length - 1);
          const isCurrent = p === current;
          const isDone = committed.has(p);
          return (
            <g key={p}>
              <circle
                cx={xCenter}
                cy={y}
                r={isCurrent ? 8 : 6}
                fill={
                  isDone ? 'var(--acc)' : isCurrent ? 'var(--acc-2)' : 'var(--bg-3)'
                }
                stroke={isCurrent ? 'var(--acc-2)' : 'var(--line-2)'}
                strokeWidth={isCurrent ? 2 : 1}
                className={cn(isCurrent && 'animate-pulse')}
              />
              <text
                x={xCenter + 16}
                y={y + 4}
                fill={isCurrent ? 'var(--acc-2)' : 'var(--text-2)'}
                fontSize="11"
                fontFamily="monospace"
              >
                {p}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
