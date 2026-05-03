/**
 * Tauri 桌面端 SubmissionQueue 实现，调 Rust 端 5 个 queue command。
 *
 * 注：Rust 端 payload 用字符串存（JSON），这里负责 stringify/parse。
 */

import { invoke } from '@tauri-apps/api/core';
import type { RecordCreate } from '@/types/api';
import type {
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

export class TauriQueue implements SubmissionQueue {
  async enqueue(
    item: Omit<PendingItem, 'status' | 'attempt_count' | 'last_error' | 'created_at'>,
  ): Promise<void> {
    await invoke('queue_enqueue', {
      clientUid: item.client_uid,
      payload: JSON.stringify(item.payload),
    });
  }

  async drain(maxBatch: number): Promise<PendingItem[]> {
    const items = await invoke<RustPendingItem[]>('queue_drain', { max: maxBatch });
    return items.map((r) => ({
      client_uid: r.client_uid,
      payload: safeParse<RecordCreate>(r.payload),
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
    // Rust 端 max_attempts 固定为 5；前端参数仅作占位以保持接口对称。
    await invoke('queue_mark_failed', { uid, error });
  }

  async count(): Promise<QueueCount> {
    return invoke<RustQueueCount>('queue_count');
  }
}

function safeParse<T>(s: string): T {
  return JSON.parse(s) as T;
}
