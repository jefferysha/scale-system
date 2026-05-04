import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
 * 称重页左侧数据表：调用后端 cursor 分页（limit=20），UI 用页码呈现。
 * 每条记录的下一页 cursor 通过 fetchNextPage 加入 useInfiniteQuery 的页面数组，
 * 我们再用本地 pageIndex 切片当前页，"上一页"等同回跳已加载的页索引。
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

  const onPrev = (): void => {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
  };
  const onNext = async (): Promise<void> => {
    if (pageIndex + 1 < pages.length) {
      setPageIndex(pageIndex + 1);
      return;
    }
    if (hasNextPage) {
      await fetchNextPage();
      setPageIndex(pageIndex + 1);
    }
  };

  const canPrev = pageIndex > 0;
  const canNext = pageIndex + 1 < pages.length || !!hasNextPage;

  return (
    <section className="flex h-full flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">数据表格</h3>
        <span className="text-xs text-[var(--text-3)]" data-testid="records-count">
          已加载 {totalLoaded} 条
        </span>
        {isLoading || isFetching ? (
          <span className="text-xs text-[var(--text-3)]">加载中…</span>
        ) : null}
      </header>
      <div className="flex-1 overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="sticky top-0 bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-2 py-1 text-left">日期</th>
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
                    <td className="px-2 py-1">{r.sample_date}</td>
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
      <footer className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2 text-xs text-[var(--text-3)]">
        <span data-testid="records-page-info">
          第 {pageIndex + 1} 页 · 每页 {PAGE_SIZE}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={onPrev}
            data-testid="records-prev"
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext || isFetching}
            onClick={() => void onNext()}
            data-testid="records-next"
          >
            {isFetching && pageIndex + 1 >= pages.length ? '加载中…' : '下一页'}
          </Button>
        </div>
      </footer>
    </section>
  );
}
