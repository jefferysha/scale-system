import { MOCK_RECORDS } from '../mock-data';

const POSITIONS = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

export function RecordsTable(): React.ReactElement {
  const rows = MOCK_RECORDS;
  return (
    <section className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">数据表格</h3>
        <span className="text-xs text-[var(--text-3)]">合计 {rows.length} 条</span>
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
                  暂无记录
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)]">
                  <td className="px-2 py-1">{r.sample_date}</td>
                  <td className="px-2 py-1 truncate" title={String(r.project_id)}>
                    P-{r.project_id}
                  </td>
                  <td className="px-2 py-1 text-right">{r.water_depth_m}</td>
                  {r.points.map((p) => (
                    <td key={p.pos} className="px-2 py-1 text-right">
                      {p.concentration_mg_l.toFixed(4)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-[var(--acc)]">
                    {r.computed_avg_concentration?.toFixed(4) ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
