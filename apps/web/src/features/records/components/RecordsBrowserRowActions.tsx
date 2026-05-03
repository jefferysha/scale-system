import { Button } from '@/components/ui/button';

interface Props {
  hasNext: boolean;
  isFetching: boolean;
  totalLoaded: number;
  onLoadMore: () => void;
}

export function RecordsBrowserRowActions({
  hasNext,
  isFetching,
  totalLoaded,
  onLoadMore,
}: Props): React.ReactElement {
  return (
    <footer className="flex items-center justify-between text-xs text-[var(--text-3)]">
      <span data-testid="records-loaded-count">已加载 {totalLoaded} 条</span>
      {hasNext ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isFetching}
          data-testid="records-load-more"
        >
          {isFetching ? '加载中…' : '加载更多'}
        </Button>
      ) : (
        <span>已全部加载</span>
      )}
    </footer>
  );
}
