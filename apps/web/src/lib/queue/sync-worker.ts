import { api } from '@/lib/api/client';
import type { BatchResponse } from '@/types/api';
import type { SubmissionQueue } from './submission-queue';

const TICK_INTERVAL_MS = 30_000;
const MAX_BATCH = 100;
const MAX_ATTEMPTS = 5;

/**
 * 启动后台同步：定时 + online + 立即 1 次。返回 stop 函数。
 *
 * 暴露 tick 给上层可以"立即触发一次"。
 */
export interface SyncWorkerHandle {
  stop: () => void;
  tick: () => Promise<void>;
}

export const startSyncWorker = (queue: SubmissionQueue): SyncWorkerHandle => {
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const items = await queue.drain(MAX_BATCH);
    if (items.length === 0) return;
    try {
      const r = await api.post<BatchResponse>('/records/batch', {
        records: items.map((i) => i.payload),
      });
      const synced: string[] = [];
      for (const result of r.data.results) {
        if (result.status === 'created' || result.status === 'duplicate') {
          synced.push(result.client_uid);
        } else {
          await queue.markFailed(
            result.client_uid,
            result.error ?? 'invalid',
            MAX_ATTEMPTS,
          );
        }
      }
      await queue.markSynced(synced);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'network error';
      // 整批回滚到 failed，留待下次 tick。
      for (const i of items) {
        await queue.markFailed(i.client_uid, msg, MAX_ATTEMPTS);
      }
    }
  };

  const intervalId = window.setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);
  const onOnline = (): void => {
    void tick();
  };
  window.addEventListener('online', onOnline);

  // 立即触发一次
  void tick();

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener('online', onOnline);
    },
    tick,
  };
};
