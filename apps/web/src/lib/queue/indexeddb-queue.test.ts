import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RecordCreate } from '@/types/api';
import { IndexedDbQueue } from './indexeddb-queue';

// idb-keyval 在 jsdom 下走内置 indexedDB；如果没有就用 in-memory mock。
vi.mock('idb-keyval', () => {
  let store: unknown = undefined;
  return {
    get: vi.fn(async (_key: string) => store),
    set: vi.fn(async (_key: string, value: unknown) => {
      store = value;
    }),
  };
});

const mkPayload = (uid: string): RecordCreate => ({
  client_uid: uid,
  project_id: 1,
  vertical_id: 11,
  sample_date: '2026-05-03',
  volume_ml: 500,
  points: [],
});

describe('IndexedDbQueue', () => {
  let queue: IndexedDbQueue;

  beforeEach(async () => {
    const m = await import('idb-keyval');
    (m.set as unknown as { mockClear: () => void }).mockClear?.();
    // 重置 store
    await m.set('pending_records_v1', undefined);
    queue = new IndexedDbQueue();
  });

  it('enqueue 同 uid 幂等', async () => {
    await queue.enqueue({ client_uid: 'u1', payload: mkPayload('u1') });
    await queue.enqueue({ client_uid: 'u1', payload: mkPayload('u1') });
    const list = await queue.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.attempt_count).toBe(0);
  });

  it('drain 取出 pending/failed，状态切换为 syncing', async () => {
    await queue.enqueue({ client_uid: 'u1', payload: mkPayload('u1') });
    await queue.enqueue({ client_uid: 'u2', payload: mkPayload('u2') });
    const drained = await queue.drain(10);
    expect(drained).toHaveLength(2);
    const list = await queue.list();
    expect(list.every((i) => i.status === 'syncing')).toBe(true);
  });

  it('markSynced 移除条目', async () => {
    await queue.enqueue({ client_uid: 'u1', payload: mkPayload('u1') });
    await queue.drain(10);
    await queue.markSynced(['u1']);
    expect(await queue.list()).toHaveLength(0);
  });

  it('markFailed 累计 attempt，达到 max 进入 needs_review', async () => {
    await queue.enqueue({ client_uid: 'u1', payload: mkPayload('u1') });
    await queue.drain(10);
    await queue.markFailed('u1', 'net err', 3);
    let list = await queue.list();
    expect(list[0]?.status).toBe('failed');
    expect(list[0]?.attempt_count).toBe(1);
    await queue.markFailed('u1', 'net err', 3);
    await queue.markFailed('u1', 'net err', 3);
    list = await queue.list();
    expect(list[0]?.status).toBe('needs_review');
    expect(list[0]?.attempt_count).toBe(3);
  });

  it('count 区分 pending 与 needs_review', async () => {
    await queue.enqueue({ client_uid: 'u1', payload: mkPayload('u1') });
    await queue.enqueue({ client_uid: 'u2', payload: mkPayload('u2') });
    await queue.drain(10);
    await queue.markFailed('u1', 'x', 1);
    const c = await queue.count();
    expect(c.needs_review).toBe(1);
    expect(c.pending).toBe(1);
  });
});
