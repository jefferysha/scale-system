import { useWeighingRecordsLive } from '../hooks';

const POSITIONS = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

const formatCol = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '—';
  const v = typeof raw === 'string' ? Number(raw) : (raw as number);
  return Number.isFinite(v) ? v.toFixed(4) : '—';
};

interface PointMap {
  [pos: string]: { concentration_mg_l?: unknown };
}

interface Props {
  filter: { project_id?: number; vertical_id?: number };
}

export function RecordsTable({ filter }: Props): React.ReactElement {
  const { data, isLoading } = useWeighingRecordsLive(filter);
  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">数据表格</h3>
        <span className="text-xs text-[var(--text-3)]" data-testid="records-count">
          合计 {rows.length} 条
        </span>
        {isLoading ? <span className="text-xs text-[var(--text-3)]">加载中…</span> : null}
      </header>
      <div className="overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-2 py-1 text-left">日期</th>
              <th className="px-2 py-1 text-left">项目</th>
              <th className="px-2 py-1 text-right">水深</th>
              {POSITIONS.map((p) => (
                <th key={p} className="px-2 py-1 text-right">
                  {p}
                </th>
              ))}
              <th className="px-2 py-1 text-right">含沙量</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-2 py-4 text-center text-[var(--text-3)]">
                  {filter.project_id ? '暂无记录' : '请先选择项目'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const points = (r.points ?? []) as Array<Record<string, unknown>>;
                const map: PointMap = {};
                for (const p of points) {
                  const pos = String(p.pos ?? '');
                  if (pos) map[pos] = { concentration_mg_l: p.concentration_mg_l };
                }
                return (
                  <tr key={r.id} className="border-b border-[var(--line)]">
                    <td className="px-2 py-1">{r.sample_date}</td>
                    <td className="px-2 py-1">P-{r.project_id}</td>
                    <td className="px-2 py-1 text-right">{r.water_depth_m ?? '—'}</td>
                    {POSITIONS.map((p) => (
                      <td key={p} className="px-2 py-1 text-right">
                        {formatCol(map[p]?.concentration_mg_l)}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right text-[var(--acc)]">
                      {r.computed_avg_concentration ?? '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
