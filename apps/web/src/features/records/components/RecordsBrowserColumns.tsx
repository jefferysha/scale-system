import type { RecordItem } from '@/types/api';

const POSITIONS = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'] as const;

const formatPoint = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '—';
  const v = typeof raw === 'string' ? Number(raw) : (raw as number);
  return Number.isFinite(v) ? v.toFixed(4) : '—';
};

interface Props {
  rows: RecordItem[];
  onSelect: (r: RecordItem) => void;
  onDelete?: (r: RecordItem) => void;
  isAdmin: boolean;
}

interface PointMap {
  [pos: string]: { concentration_mg_l?: unknown };
}

const pickPoints = (record: RecordItem): PointMap => {
  const list = record.points as Array<Record<string, unknown>>;
  const map: PointMap = {};
  for (const p of list) {
    const pos = String(p.pos ?? '');
    if (pos) map[pos] = { concentration_mg_l: p.concentration_mg_l };
  }
  return map;
};

export function RecordsBrowserColumns({
  rows,
  onSelect,
  onDelete,
  isAdmin,
}: Props): React.ReactElement {
  return (
    <div className="overflow-auto rounded-md border border-[var(--line)]">
      <table className="w-full font-mono text-xs">
        <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
          <tr>
            <th className="whitespace-nowrap px-2 py-2 text-left">日期</th>
            <th className="whitespace-nowrap px-2 py-2 text-left">项目</th>
            <th className="whitespace-nowrap px-2 py-2 text-left">垂线</th>
            <th className="whitespace-nowrap px-2 py-2 text-right">水深 m</th>
            {POSITIONS.map((p) => (
              <th key={p} className="whitespace-nowrap px-2 py-2 text-right">
                {p}
              </th>
            ))}
            <th className="whitespace-nowrap px-2 py-2 text-right">平均含沙</th>
            <th className="whitespace-nowrap px-2 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-2 py-8 text-center text-[var(--text-3)]">
                暂无记录
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const pts = pickPoints(r);
              return (
                <tr
                  key={r.id}
                  className="border-t border-[var(--line)] hover:bg-[var(--bg-2)]/40"
                  data-testid={`record-row-${r.id}`}
                >
                  <td className="whitespace-nowrap px-2 py-1.5">{r.sample_date}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">P-{r.project_id}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">V-{r.vertical_id}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {r.water_depth_m ?? '—'}
                  </td>
                  {POSITIONS.map((p) => (
                    <td key={p} className="whitespace-nowrap px-2 py-1.5 text-right">
                      {formatPoint(pts[p]?.concentration_mg_l)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-[var(--acc)]">
                    {r.computed_avg_concentration ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button
                      type="button"
                      className="text-[var(--acc)] hover:underline"
                      onClick={() => onSelect(r)}
                      data-testid={`record-detail-${r.id}`}
                    >
                      详情
                    </button>
                    {isAdmin && onDelete ? (
                      <>
                        <span className="px-1 text-[var(--text-3)]">|</span>
                        <button
                          type="button"
                          className="text-[var(--danger)] hover:underline"
                          onClick={() => onDelete(r)}
                        >
                          删除
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
