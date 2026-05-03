import { get, set } from 'idb-keyval';
import type {
  PendingItem,
  PendingStatus,
  QueueCount,
  SubmissionQueue,
} from './submission-queue';

const STORE_KEY = 'pending_records_v1';

/**
 * IndexedDB 实现：通过 idb-keyval 把整个 map 写在一个 key 下。
 * 4-6 周内队列长度通常 < 几百，整体读写够用。
 */
export class IndexedDbQueue implements SubmissionQueue {
  private async readMap(): Promise<Record<string, PendingItem>> {
    const raw = (await get(STORE_KEY)) as Record<string, PendingItem> | undefined;
    return raw ?? {};
  }

  private async writeMap(map: Record<string, PendingItem>): Promise<void> {
    await set(STORE_KEY, map);
  }

  async enqueue(
    item: Omit<PendingItem, 'status' | 'attempt_count' | 'last_error' | 'created_at'>,
  ): Promise<void> {
    const map = await this.readMap();
    if (map[item.client_uid]) return; // 幂等，已存在不覆盖
    map[item.client_uid] = {
      ...item,
      status: 'pending',
      attempt_count: 0,
      last_error: null,
      created_at: Date.now(),
    };
    await this.writeMap(map);
  }

  async drain(maxBatch: number): Promise<PendingItem[]> {
    const map = await this.readMap();
    const eligible = Object.values(map)
      .filter((i) => i.status === 'pending' || i.status === 'failed')
      .sort((a, b) => a.created_at - b.created_at)
      .slice(0, maxBatch);
    if (eligible.length === 0) return [];
    for (const i of eligible) {
      map[i.client_uid] = { ...i, status: 'syncing' as PendingStatus };
    }
    await this.writeMap(map);
    return eligible;
  }

  async markSynced(uids: string[]): Promise<void> {
    if (uids.length === 0) return;
    const map = await this.readMap();
    for (const uid of uids) delete map[uid];
    await this.writeMap(map);
  }

  async markFailed(uid: string, error: string, max_attempts: number): Promise<void> {
    const map = await this.readMap();
    const cur = map[uid];
    if (!cur) return;
    const attempt_count = cur.attempt_count + 1;
    const status: PendingStatus = attempt_count >= max_attempts ? 'needs_review' : 'failed';
    map[uid] = { ...cur, status, attempt_count, last_error: error };
    await this.writeMap(map);
  }

  async count(): Promise<QueueCount> {
    const map = await this.readMap();
    let pending = 0;
    let needs_review = 0;
    for (const i of Object.values(map)) {
      if (i.status === 'needs_review') needs_review += 1;
      else pending += 1;
    }
    return { pending, needs_review };
  }

  async list(): Promise<PendingItem[]> {
    const map = await this.readMap();
    return Object.values(map);
  }
}
