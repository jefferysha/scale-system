import type { RecordCreate } from '@/types/api';

/**
 * 队列条目状态：
 * - pending：未尝试或已重置等待发送
 * - syncing：worker 正在 batch（drain 后 markSynced/markFailed 之前）
 * - failed：本次失败但仍可重试（attempt_count 未达阈值）
 * - needs_review：达到 max_attempts 仍失败 / 服务器返回 invalid，需人工处置
 */
export type PendingStatus = 'pending' | 'syncing' | 'failed' | 'needs_review';

export interface PendingItem {
  client_uid: string;
  payload: RecordCreate;
  status: PendingStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: number;
}

export interface QueueCount {
  pending: number;
  needs_review: number;
}

export interface SubmissionQueue {
  enqueue(
    item: Omit<PendingItem, 'status' | 'attempt_count' | 'last_error' | 'created_at'>,
  ): Promise<void>;
  drain(maxBatch: number): Promise<PendingItem[]>;
  markSynced(uids: string[]): Promise<void>;
  markFailed(uid: string, error: string, max_attempts: number): Promise<void>;
  count(): Promise<QueueCount>;
  /**
   * 调试/测试用：列出全量条目。
   */
  list(): Promise<PendingItem[]>;
}
