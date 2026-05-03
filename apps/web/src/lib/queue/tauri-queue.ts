/**
 * Tauri 桌面端 SubmissionQueue 实现，调 Rust 端 4+1 个 queue command。
 *
 * 注：Rust 端 payload 用字符串存（JSON），这里负责 stringify/parse。
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  EnqueueInput,
  PendingItem,
  PendingStatus,
  QueueCount,
  SubmissionQueue,
} from './submission-queue';

interface RustPendingItem {
  client_uid: string;
  payload: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

interface RustQueueCount {
  pending: number;
  needs_review: number;
}

const toPendingStatus = (s: string): PendingStatus => {
  if (
    s === 'pending' ||
    s === 'syncing' ||
    s === 'failed' ||
    s === 'needs_review' ||
    s === 'synced'
  ) {
    return s;
  }
  return 'pending';
};

export class TauriQueue<TPayload = unknown> implements SubmissionQueue<TPayload> {
  async enqueue(item: EnqueueInput<TPayload>): Promise<void> {
    await invoke('queue_enqueue', {
      clientUid: item.client_uid,
      payload: JSON.stringify(item.payload),
    });
  }

  async drain(maxBatch: number): Promise<PendingItem<TPayload>[]> {
    const items = await invoke<RustPendingItem[]>('queue_drain', { max: maxBatch });
    return items.map((r) => ({
      client_uid: r.client_uid,
      payload: safeParse<TPayload>(r.payload),
      status: toPendingStatus(r.status),
      attempt_count: r.attempt_count,
      last_error: r.last_error,
      created_at: r.created_at,
    }));
  }

  async markSynced(uids: string[]): Promise<void> {
    await invoke('queue_mark_synced', { uids });
  }

  async markFailed(uid: string, error: string, _maxAttempts: number): Promise<void> {
    // Rust 端的 max_attempts 由 Tauri 层固定为 5，前端参数仅作占位以保持接口对称。
    await invoke('queue_mark_failed', { uid, error });
  }

  async count(): Promise<QueueCount> {
    return invoke<RustQueueCount>('queue_count');
  }
}

function safeParse<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return s as unknown as T;
  }
}
