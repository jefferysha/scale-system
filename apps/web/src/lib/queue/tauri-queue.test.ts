/**
 * E2E-11 断网重连（桌面端）— 单测版本。
 *
 * 用 vi.mock 替换 @tauri-apps/api/core 的 invoke，模拟 Rust 端 SQLite 行为，
 * 覆盖：enqueue → drain → markFailed×5 → needs_review → drain 不再返回。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordCreate } from '@/types/api';

const mockPayload = (uid: string, extra: Partial<RecordCreate> = {}): RecordCreate => ({
  client_uid: uid,
  project_id: 1,
  vertical_id: 1,
  sample_date: '2026-05-03',
  volume_ml: 1000,
  points: [],
  ...extra,
});

interface MockRow {
  client_uid: string;
  payload: string;
  status: 'pending' | 'syncing' | 'failed' | 'needs_review' | 'synced';
  attempt_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

const MAX_ATTEMPTS = 5;

interface InvokeArgs {
  client_uid?: string;
  clientUid?: string;
  payload?: string;
  uid?: string;
  uids?: string[];
  error?: string;
  max?: number;
}

/** 内存 Rust 端模拟。和 queue/db.rs 行为一致（按 plan §6.4 状态机）。 */
const makeFakeRustQueue = () => {
  const rows: MockRow[] = [];
  return async (cmd: string, args: InvokeArgs = {}): Promise<unknown> => {
    switch (cmd) {
      case 'queue_enqueue': {
        const uid = args.clientUid ?? args.client_uid ?? '';
        if (rows.find((r) => r.client_uid === uid)) return undefined; // INSERT OR IGNORE
        rows.push({
          client_uid: uid,
          payload: args.payload ?? '',
          status: 'pending',
          attempt_count: 0,
          last_error: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
        return undefined;
      }
      case 'queue_drain': {
        const max = args.max ?? 0;
        return rows
          .filter(
            (r) =>
              (r.status === 'pending' || r.status === 'failed') && r.attempt_count < MAX_ATTEMPTS,
          )
          .slice(0, max);
      }
      case 'queue_mark_synced': {
        for (const u of args.uids ?? []) {
          const r = rows.find((x) => x.client_uid === u);
          if (r) r.status = 'synced';
        }
        return undefined;
      }
      case 'queue_mark_failed': {
        const r = rows.find((x) => x.client_uid === args.uid);
        if (!r) return undefined;
        r.attempt_count += 1;
        r.last_error = args.error ?? null;
        r.status = r.attempt_count >= MAX_ATTEMPTS ? 'needs_review' : 'failed';
        return undefined;
      }
      case 'queue_count': {
        const pending = rows.filter((r) => r.status === 'pending' || r.status === 'failed').length;
        const needs_review = rows.filter((r) => r.status === 'needs_review').length;
        return { pending, needs_review };
      }
      default:
        throw new Error(`unmocked command ${cmd}`);
    }
  };
};

const invokeImpl = vi.fn<(cmd: string, args?: InvokeArgs) => Promise<unknown>>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: InvokeArgs) => invokeImpl(cmd, args),
}));

// 必须在 vi.mock 之后 import
const { TauriQueue } = await import('./tauri-queue');

describe('TauriQueue · 离线重试链路', () => {
  beforeEach(() => {
    invokeImpl.mockReset();
    invokeImpl.mockImplementation(makeFakeRustQueue());
  });

  it('enqueue 后 drain 能取出', async () => {
    const q = new TauriQueue();
    await q.enqueue({ client_uid: 'u1', payload: mockPayload('u1', { project_id: 7 }) });
    const items = await q.drain(10);
    expect(items).toHaveLength(1);
    const first = items[0]!;
    expect(first.client_uid).toBe('u1');
    expect(first.payload.project_id).toBe(7);
  });

  it('markSynced 后不再被 drain', async () => {
    const q = new TauriQueue();
    await q.enqueue({ client_uid: 'u1', payload: mockPayload('u1') });
    await q.markSynced(['u1']);
    expect(await q.drain(10)).toHaveLength(0);
  });

  it('断网重试：markFailed×5 后转 needs_review，不再被 drain', async () => {
    const q = new TauriQueue();
    await q.enqueue({ client_uid: 'u1', payload: mockPayload('u1') });
    for (let i = 0; i < 5; i++) {
      await q.markFailed('u1', 'network down', 5);
    }
    expect(await q.drain(10)).toHaveLength(0);
    const c = await q.count();
    expect(c.needs_review).toBe(1);
    expect(c.pending).toBe(0);
  });

  it('payload 序列化：复杂对象走 JSON 往返', async () => {
    const q = new TauriQueue();
    await q.enqueue({
      client_uid: 'u1',
      payload: mockPayload('u1', {
        notes: 'tag-a tag-b',
        water_depth_m: 9.4,
      }),
    });
    const items = await q.drain(10);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.payload.notes).toBe('tag-a tag-b');
    expect(item.payload.water_depth_m).toBe(9.4);
  });

  it('enqueue 幂等：同 uid 重复入队只保留一条', async () => {
    const q = new TauriQueue();
    await q.enqueue({ client_uid: 'u1', payload: mockPayload('u1') });
    await q.enqueue({ client_uid: 'u1', payload: mockPayload('u1', { project_id: 999 }) });
    expect(await q.drain(10)).toHaveLength(1);
  });
});
