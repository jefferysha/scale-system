import { useState } from 'react';
import { Pagination } from '@/components/ui/pagination';
import { useWeighingRecordsLive } from '../hooks';

const POSITIONS = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];
const PAGE_SIZE = 20;

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

/**
 * 称重页左侧数据表：复用后端 cursor 分页（limit=20）。
 * 用本地 pageIndex 切片当前页，"上一页"等同回跳已加载页索引；
 * 切换到尚未加载的页时调 fetchNextPage 拉取下一段 cursor。
 */
export function RecordsTable({ filter }: Props): React.ReactElement {
  const { data, isLoading, isFetching, hasNextPage, fetchNextPage } = useWeighingRecordsLive({
    ...filter,
    limit: PAGE_SIZE,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const pages = data?.pages ?? [];
  const currentRows = pages[pageIndex]?.items ?? [];
  const totalLoaded = pages.reduce((acc, p) => acc + p.items.length, 0);

  const goToPage = async (target: number): Promise<void> => {
    const targetIdx = target - 1;
    if (targetIdx < 0) return;
    if (targetIdx < pages.length) {
      setPageIndex(targetIdx);
      return;
    }
    if (hasNextPage) {
      await fetchNextPage();
      setPageIndex(Math.min(targetIdx, pages.length));
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">数据表格</h3>
        <span className="text-xs text-[var(--text-3)]" data-testid="records-count">
          已加载 {totalLoaded} 条
        </span>
        {isLoading || isFetching ? (
          <span className="text-xs text-[var(--text-3)]">加载中…</span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="whitespace-nowrap px-2 py-1.5 text-left">日期</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right">水深</th>
              {POSITIONS.map((p) => (
                <th key={p} className="whitespace-nowrap px-2 py-1.5 text-right">
                  {p}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-1.5 text-right">含沙量</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-[var(--text-3)]">
                  {filter.project_id ? '暂无记录' : '请先选择项目'}
                </td>
              </tr>
            ) : (
              currentRows.map((r) => {
                const points = (r.points ?? []) as Array<Record<string, unknown>>;
                const map: PointMap = {};
                for (const p of points) {
                  const pos = String(p.pos ?? '');
                  if (pos) map[pos] = { concentration_mg_l: p.concentration_mg_l };
                }
                return (
                  <tr key={r.id} className="border-b border-[var(--line)]">
                    <td className="whitespace-nowrap px-2 py-1.5">{r.sample_date}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      {r.water_depth_m ?? '—'}
                    </td>
                    {POSITIONS.map((p) => (
                      <td key={p} className="whitespace-nowrap px-2 py-1.5 text-right">
                        {formatCol(map[p]?.concentration_mg_l)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-[var(--acc)]">
                      {r.computed_avg_concentration ?? '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pageIndex + 1}
        pageSize={PAGE_SIZE}
        totalItems={totalLoaded}
        hasNext={hasNextPage}
        isLoading={isFetching}
        onChange={(p) => void goToPage(p)}
        className="border-t border-[var(--line)]"
      />
    </section>
  );
}
