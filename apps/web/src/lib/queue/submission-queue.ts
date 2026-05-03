/**
 * 离线队列接口（桌面端用 rusqlite，浏览器端用 IndexedDB）。
 *
 * 业务 payload 结构由调用方决定，本接口用 `unknown` 通用化。Phase 5 合 main 后
 * 若同时声明了更具体的 RecordCreate 类型，可在调用处收敛 generic 参数。
 */

export type PendingStatus = 'pending' | 'syncing' | 'failed' | 'needs_review' | 'synced';

export interface PendingItem<TPayload = unknown> {
  client_uid: string;
  payload: TPayload;
  status: PendingStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: number;
}

export interface QueueCount {
  pending: number;
  needs_review: number;
}

export interface EnqueueInput<TPayload = unknown> {
  client_uid: string;
  payload: TPayload;
}

export interface SubmissionQueue<TPayload = unknown> {
  enqueue(item: EnqueueInput<TPayload>): Promise<void>;
  drain(maxBatch: number): Promise<PendingItem<TPayload>[]>;
  markSynced(uids: string[]): Promise<void>;
  markFailed(uid: string, error: string, maxAttempts: number): Promise<void>;
  count(): Promise<QueueCount>;
}
