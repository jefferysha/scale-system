import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSubmissionQueue } from '@/lib/platform';
import { startSyncWorker, type SyncWorkerHandle } from '@/lib/queue/sync-worker';

const REFRESH_INTERVAL_MS = 5_000;

export function PendingBanner(): React.ReactElement | null {
  const [pending, setPending] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [worker, setWorker] = useState<SyncWorkerHandle | null>(null);

  useEffect(() => {
    const queue = getSubmissionQueue();
    const handle = startSyncWorker(queue);
    setWorker(handle);

    const refresh = async (): Promise<void> => {
      const c = await queue.count();
      setPending(c.pending);
      setNeedsReview(c.needs_review);
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      handle.stop();
    };
  }, []);

  if (pending === 0 && needsReview === 0) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2 text-xs"
      data-testid="pending-banner"
    >
      <span>
        待同步：<strong className="font-mono text-[var(--warn)]">{pending}</strong> 条
      </span>
      {needsReview > 0 ? (
        <span>
          需人工：<strong className="font-mono text-[var(--danger)]">{needsReview}</strong> 条
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => void worker?.tick()}
        data-testid="pending-trigger"
      >
        <RefreshCw className="size-3" /> 立即同步
      </Button>
    </div>
  );
}
