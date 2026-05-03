import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Cup } from '@/types/api';
import { useCalibrations } from '../hooks';

interface Props {
  cup: Cup | null;
  onClose: () => void;
}

export function CalibrationHistoryDrawer({ cup, onClose }: Props): React.ReactElement | null {
  const { data: rows = [], isLoading } = useCalibrations(cup?.id);
  if (!cup) return null;

  const sorted = [...rows].sort(
    (a, b) => new Date(b.calibrated_at).getTime() - new Date(a.calibrated_at).getTime(),
  );

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-[var(--line)] bg-[var(--bg-1)] shadow-xl"
      data-testid="cal-history-drawer"
    >
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            率定历史 — {cup.cup_number}
          </h3>
          <p className="text-xs text-[var(--text-3)]">最近 {rows.length} 条</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3 text-xs">
        {isLoading ? (
          <p className="text-[var(--text-3)]">加载中…</p>
        ) : sorted.length === 0 ? (
          <p className="text-[var(--text-3)]">尚无率定历史</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-[var(--line)] bg-[var(--bg-2)]/40 p-3"
                data-testid={`cal-row-${c.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{c.tare_g} g</span>
                  <span className="text-[var(--text-3)]">
                    {new Date(c.calibrated_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="mt-1 text-[var(--text-2)]">{c.method ?? '—'}</div>
                {c.notes ? (
                  <div className="mt-1 text-[var(--text-3)]">{c.notes}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
