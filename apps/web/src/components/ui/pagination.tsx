import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** 当前页 (1-based) */
  page: number;
  /** 总页数；未知时传 undefined（cursor 分页场景） */
  totalPages?: number;
  /** 总条数（可选） */
  totalItems?: number;
  /** 每页条数 */
  pageSize: number;
  /** 切到第 n 页 */
  onChange: (page: number) => void;
  /** 是否还能往后翻（cursor 模式没 totalPages 时用此判断） */
  hasNext?: boolean;
  isLoading?: boolean;
  className?: string;
  /** 数字按钮窗口大小，默认 5 */
  windowSize?: number;
}

/**
 * 复用通用分页器：1 2 3 ... N + 上一/下一页 + 总条数。
 * - totalPages 已知（offset 分页）：完整数字页码
 * - totalPages 未知（cursor 分页）：仅显示已加载的连续页 + 下一页探测
 */
export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
  hasNext,
  isLoading,
  className,
  windowSize = 5,
}: Props): React.ReactElement {
  const visiblePages = computePageWindow(page, totalPages ?? page + (hasNext ? 1 : 0), windowSize);
  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : !!hasNext;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--text-3)]',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {totalItems !== undefined ? (
          <span data-testid="pagination-total">共 {totalItems} 条</span>
        ) : null}
        <span data-testid="pagination-info">
          每页 {pageSize}
          {totalPages ? ` · 共 ${totalPages} 页` : ''}
        </span>
      </div>
      <nav className="flex items-center gap-1" aria-label="分页">
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          disabled={!canPrev || isLoading}
          onClick={() => onChange(page - 1)}
          aria-label="上一页"
          data-testid="page-prev"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {totalPages && totalPages > 0 ? (
          <>
            {(() => {
              const first = visiblePages[0];
              const last = visiblePages[visiblePages.length - 1];
              return (
                <>
                  {first !== undefined && first > 1 ? (
                    <>
                      <PageBtn page={1} active={page === 1} onClick={onChange} />
                      {first > 2 ? <Ellipsis /> : null}
                    </>
                  ) : null}
                  {visiblePages.map((p) => (
                    <PageBtn key={p} page={p} active={p === page} onClick={onChange} />
                  ))}
                  {last !== undefined && last < totalPages ? (
                    <>
                      {last < totalPages - 1 ? <Ellipsis /> : null}
                      <PageBtn page={totalPages} active={page === totalPages} onClick={onChange} />
                    </>
                  ) : null}
                </>
              );
            })()}
          </>
        ) : (
          <>
            {visiblePages.map((p) => (
              <PageBtn
                key={p}
                page={p}
                active={p === page}
                disabled={p > page && !hasNext}
                onClick={onChange}
              />
            ))}
          </>
        )}

        <Button
          variant="outline"
          size="icon"
          className="size-7"
          disabled={!canNext || isLoading}
          onClick={() => onChange(page + 1)}
          aria-label="下一页"
          data-testid="page-next"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </nav>
    </div>
  );
}

function PageBtn({
  page,
  active,
  disabled,
  onClick,
}: {
  page: number;
  active: boolean;
  disabled?: boolean;
  onClick: (p: number) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onClick(page)}
      disabled={disabled}
      data-testid={`page-${page}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'h-7 min-w-[28px] rounded-md border px-2 font-mono text-xs transition-colors',
        active
          ? 'border-[var(--acc)] bg-[var(--acc-shade)] text-[var(--acc)]'
          : 'border-[var(--line-2)] bg-[var(--bg-1)] text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--acc)]',
        disabled && 'cursor-not-allowed opacity-40 hover:border-[var(--line-2)] hover:text-[var(--text-2)]',
      )}
    >
      {page}
    </button>
  );
}

function Ellipsis(): React.ReactElement {
  return <span className="px-1 text-[var(--text-3)]">…</span>;
}

function computePageWindow(current: number, totalKnown: number, size: number): number[] {
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(totalKnown, start + size - 1);
  start = Math.max(1, end - size + 1);
  const result: number[] = [];
  for (let p = start; p <= end; p++) result.push(p);
  return result;
}
