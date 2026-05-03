# Phase 5 · 前端 CRUD + 接真 BE + E2E 完整动线

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 2 + Phase 4 已合 main。Worktree：`../scale-system-fe-crud` 分支 `phase-5/frontend-crud`。

**Goal:** 落地 4 个 CRUD 管理页（scales/projects/cups/records），把 weighing.tsx 从 mock 切到真 BE，IndexedDB 离线队列 + SyncWorker，补完 spec §12.2 中 12 条 E2E（除桌面专属 E2E-11）。

**Architecture:** Feature-based。每个 entity 一个 feature 目录（api/hooks/components）。所有服务端态走 TanStack Query，错误走统一 ApiError → toast。表单走 React Hook Form + Zod。

**Tech Stack:** Phase 3 已建栈 + `@tanstack/react-table`（列表）+ `idb-keyval`（IndexedDB 队列）+ `cmdk`（项目下拉的 infinite scroll）+ MSW（测试）。

---

## 关键约束

1. **遵循 Phase 3 偏差修正**：Node 25 storage shim、shadcn 手写、vitest exclude e2e、worktree 必先 `pnpm install`。
2. **每个文件 ≤ 500 行**：长列表/长表单严格按 §4.3 拆。
3. **Feature 自包含**：禁止跨 feature import；只能用 `lib/` `components/` `hooks/` `stores/`。
4. **服务端态用 TanStack Query**：禁止把 API 数据塞 Zustand。
5. **API 类型只 import from `@scale/shared-types`**（Phase 2 已生成）。
6. **不修改 `lib/serial/`**（Phase 6 才接 Tauri）。

---

## Task 5.1 · 准备：API 类型契约 + 测试 fixtures

**Files:**
- Modify: `apps/web/package.json`（加 `@scale/shared-types` workspace 依赖）
- Modify: `apps/web/src/types/api.ts`
- Create: `apps/web/src/test/msw-server.ts`
- Create: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/test/setup.ts`

- [ ] **Step 1:** 改 `package.json` 加依赖

```json
"dependencies": {
  ...
  "@scale/shared-types": "workspace:*",
  "@tanstack/react-table": "^8.20.5",
  "idb-keyval": "^6.2.1",
  "cmdk": "^1.0.0",
  "uuid": "^11.0.3"
},
"devDependencies": {
  ...
  "@types/uuid": "^10.0.0"
}
```

- [ ] **Step 2:** `pnpm install`

- [ ] **Step 3:** 改 `src/types/api.ts` re-export 共享类型

```ts
import type { components, paths } from '@scale/shared-types';

export type schemas = components['schemas'];

export type Project = schemas['ProjectOut'];
export type ProjectCreate = schemas['ProjectCreate'];
export type ProjectUpdate = schemas['ProjectUpdate'];

export type Vertical = schemas['VerticalOut'];
export type VerticalCreate = schemas['VerticalCreate'];

export type Scale = schemas['ScaleOut'];
export type ScaleCreate = schemas['ScaleCreate'];
export type ScaleUpdate = schemas['ScaleUpdate'];

export type Cup = schemas['CupOut'];
export type CupCreate = schemas['CupCreate'];
export type CupCalibration = schemas['CupCalibrationOut'];

export type Record = schemas['RecordOut'];
export type RecordCreate = schemas['RecordCreate'];
export type RecordPoint = schemas['RecordPointIn'];
export type BatchResponse = schemas['BatchResponse'];

export type CursorPageProject = schemas['CursorPage_ProjectOut_'];
// ... 其他实体的 CursorPage / OffsetPage 类似

export type { paths };
```

如果 shared-types 实际生成的类型名与上面不一致，按生成的实际名调整。

- [ ] **Step 4:** 写 `src/test/msw-server.ts`

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { Project, Scale, Cup, Record } from '@/types/api';

const baseURL = 'http://localhost:54321/api/v1';

export const server = setupServer(
  http.get(`${baseURL}/auth/me`, () =>
    HttpResponse.json({
      id: 1, username: 'tester', email: null, role: 'admin', is_active: true,
      created_at: '2026-05-03T00:00:00Z', updated_at: '2026-05-03T00:00:00Z',
    }),
  ),
  // 默认列表为空
  http.get(`${baseURL}/projects`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${baseURL}/scales`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, size: 20 }),
  ),
  http.get(`${baseURL}/cups`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, size: 50 }),
  ),
  http.get(`${baseURL}/records/`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
);
```

- [ ] **Step 5:** 写 `src/test/fixtures.ts`

```ts
import type { Project, Scale, Cup, Record } from '@/types/api';

export const fxProject: Project = {
  id: 1,
  name: 'S徐六泾断面定线比测202603',
  established_date: '2026-03-01',
  notes: null,
  is_active: true,
  created_at: '2026-05-03T00:00:00Z',
  updated_at: '2026-05-03T00:00:00Z',
};

export const fxScale: Scale = {
  id: 1, name: 'XS204', model: 'Mettler XS204', protocol_type: 'mettler',
  baud_rate: 9600, data_bits: 8, parity: 'none', stop_bits: 1, flow_control: 'none',
  read_timeout_ms: 1000, decimal_places: 4, unit_default: 'g',
  notes: null, is_active: true,
  created_at: '2026-05-03T00:00:00Z', updated_at: '2026-05-03T00:00:00Z',
};

export const fxCup: Cup = {
  id: 1024, cup_number: 'C-1024', current_tare_g: '35.2480',
  latest_calibration_date: '2025-08-01', is_active: true, notes: null,
  created_at: '2026-05-03T00:00:00Z', updated_at: '2026-05-03T00:00:00Z',
};
```

- [ ] **Step 6:** 改 `src/test/setup.ts` 启动 MSW

```ts
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw-server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 保持 Node 25 storage shim（Phase 3 偏差 D1 沿用）
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null; }
  removeItem(k: string): void { this.store.delete(k); }
  setItem(k: string, v: string): void { this.store.set(k, v); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
```

- [ ] **Step 7:** 改 `lib/api/client.ts` baseURL 默认逻辑（如果还是写死 `/api/v1`，改成读 env，测试时 MSW 拦截 localhost:54321）

```ts
const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';
```

测试中 `import.meta.env.VITE_API_BASE_URL = 'http://localhost:54321/api/v1'`（在 vitest setup 里 `vi.stubEnv`）。

- [ ] **Step 8:** 提交

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/types/api.ts apps/web/src/test/
git commit -m "feat(web): 准备 CRUD 基建（API 类型 + MSW + fixtures + 测试 setup）"
```

---

## Task 5.2 · projects feature（CRUD 页 + Combobox infinite）

**Files:**
- Create: `apps/web/src/features/projects/api.ts`
- Create: `apps/web/src/features/projects/hooks.ts`
- Create: `apps/web/src/features/projects/components/ProjectList.tsx`
- Create: `apps/web/src/features/projects/components/ProjectForm.tsx`
- Create: `apps/web/src/features/projects/components/ProjectCombobox.tsx` （供 weighing 页用）
- Create: `apps/web/src/app/routes/_auth/projects.tsx`
- Test: `apps/web/src/features/projects/hooks.test.ts`

### 5.2.1 api.ts

```ts
import { api } from '@/lib/api/client';
import type { Project, ProjectCreate, ProjectUpdate, CursorPageProject } from '@/types/api';

interface ListParams {
  q?: string;
  is_active?: boolean;
  limit?: number;
  cursor?: string | null;
}

export const projectsApi = {
  list: async (params: ListParams = {}): Promise<CursorPageProject> => {
    const r = await api.get<CursorPageProject>('/projects', { params });
    return r.data;
  },
  get: async (id: number): Promise<Project> => (await api.get<Project>(`/projects/${id}`)).data,
  create: async (body: ProjectCreate): Promise<Project> =>
    (await api.post<Project>('/projects', body)).data,
  update: async (id: number, body: ProjectUpdate): Promise<Project> =>
    (await api.put<Project>(`/projects/${id}`, body)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};
```

### 5.2.2 hooks.ts

```ts
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from './api';

export const useProjectsInfinite = (params: { q?: string; is_active?: boolean; limit?: number } = {}) =>
  useInfiniteQuery({
    queryKey: ['projects', params],
    queryFn: ({ pageParam }) =>
      projectsApi.list({ ...params, cursor: pageParam ?? null, limit: params.limit ?? 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: import('@/types/api').ProjectUpdate }) =>
      projectsApi.update(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};
```

### 5.2.3 ProjectList.tsx（CRUD 页主体，列表 + 新建/编辑 dialog）

字段：name / established_date / notes / is_active。表头按创建时间倒排；顶部搜索框 + "新建" 按钮（admin 才可见）。每行有"编辑/删除"。

按 §4.3 拆：
- `ProjectList.tsx` 容器（< 200 行）
- `ProjectListColumns.tsx` 列定义
- `ProjectListFilters.tsx` 筛选条
（如果都不超 500 行可不拆，先单文件）

### 5.2.4 ProjectCombobox.tsx（供 weighing 页用）

infinite scroll + debounced search，shadcn `Popover` + `cmdk` 组合。

### 5.2.5 ProjectForm.tsx

React Hook Form + Zod schema：
```ts
const schema = z.object({
  name: z.string().min(1).max(128),
  established_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});
```

### 5.2.6 路由 routes/_auth/projects.tsx

```tsx
import ProjectList from '@/features/projects/components/ProjectList';
export default function ProjectsPage() {
  return <div className="p-4"><ProjectList /></div>;
}
```

并在 `app/router.tsx` 加 `{ path: 'projects', element: <ProjectsPage /> }` 到 RequireAuth → AppShell 子树。

### 5.2.7 测试

`hooks.test.ts` 用 MSW mock，测：
- useProjectsInfinite 默认 query
- useCreateProject 成功 invalidate

- [ ] **Step 1-9:** 按 §4.3 拆分写完所有文件 + 测试 + 跑 + 提交

```bash
git commit -m "feat(projects): CRUD 页 + ProjectCombobox infinite scroll"
```

---

## Task 5.3 · scales feature（CRUD + 探测连接 dialog）

**Files:**
- Create: `apps/web/src/features/scales/api.ts`
- Create: `apps/web/src/features/scales/hooks.ts`
- Create: `apps/web/src/features/scales/components/ScaleList.tsx`
- Create: `apps/web/src/features/scales/components/ScaleForm.tsx` （容器）
- Create: `apps/web/src/features/scales/components/ScaleFormFields.tsx` （字段编排）
- Create: `apps/web/src/features/scales/components/ScaleProtocolFields.tsx` （按 protocol_type 显隐）
- Create: `apps/web/src/features/scales/components/ScaleProbeDialog.tsx` （探测连接）
- Create: `apps/web/src/app/routes/_auth/scales.tsx`

### 5.3.1 api.ts 端点

```ts
list, get, create, update, remove,
validate: (id, body) => api.post(`/scales/${id}/validate`, body),
reportProbe: (id, body) => api.post(`/scales/${id}/probe-result`, body),
```

### 5.3.2 ScaleProbeDialog（关键交互）

打开时：
1. 调 `getSerialAdapter().listPorts()` 显示端口下拉
2. 用户选端口 → 点"开始探测"
3. 调 `adapter.probe(portId, scaleConfig, 3000)`
4. 显示结果（成功 N 个样本 / 失败错误码 + 描述）
5. 调 `scalesApi.reportProbe(id, {ok, samples_count, error?})` 回报
6. 关闭 dialog

### 5.3.3 字段保 §4.3 拆 4 文件

- ScaleForm.tsx 容器 + 提交（< 150 行）
- ScaleFormFields.tsx 通用字段（name/model/baud/data_bits/parity/stop_bits/flow_control/read_timeout_ms/decimal_places/unit_default/notes/is_active）
- ScaleProtocolFields.tsx 按 protocol_type 显隐子字段（mettler/sartorius/ohaus/generic 各自的兼容提示）
- ScaleProbeDialog.tsx 单独 dialog

### 5.3.4 路由 + 测试

测试至少 4 个用例：
- 列表渲染
- 创建（admin）
- protocol_type=mettler 时 stop_bits=2 显示 warning
- probe 成功回报后调用 `/probe-result`

- [ ] **Step 1-10:** 写代码 + 测试 + 提交

```bash
git commit -m "feat(scales): CRUD + 协议字段动态校验 + 探测连接 dialog"
```

---

## Task 5.4 · cups feature（CRUD + 率定历史）

**Files:**
- Create: `apps/web/src/features/cups/api.ts`
- Create: `apps/web/src/features/cups/hooks.ts`
- Create: `apps/web/src/features/cups/components/CupList.tsx`
- Create: `apps/web/src/features/cups/components/CupForm.tsx`
- Create: `apps/web/src/features/cups/components/CalibrationDialog.tsx`
- Create: `apps/web/src/features/cups/components/CalibrationHistoryDrawer.tsx`
- Create: `apps/web/src/app/routes/_auth/cups.tsx`

### 5.4.1 列表（offset 分页 + 模糊搜）

CupList 用 `@tanstack/react-table` + 分页 footer（"上一页/下一页/Goto"）。每行操作：编辑 / 率定 / 历史。

### 5.4.2 CalibrationDialog

填 `tare_g` + `method` + `notes`，submit 调 `POST /cups/{id}/calibrate`，成功后 invalidate `['cups']` 和 `['cup-calibrations', id]`。

### 5.4.3 CalibrationHistoryDrawer

侧栏拉出，列出该杯所有 calibrations（`GET /cups/{id}/calibrations`），按时间 DESC。

- [ ] **Step 1-9:** 写代码 + 测试 + 提交

```bash
git commit -m "feat(cups): CRUD + 率定（dialog）+ 率定历史（drawer）"
```

---

## Task 5.5 · records feature（数据浏览 + 导出）

**Files:**
- Create: `apps/web/src/features/records/api.ts`
- Create: `apps/web/src/features/records/hooks.ts`
- Create: `apps/web/src/features/records/components/RecordsBrowser.tsx`
- Create: `apps/web/src/features/records/components/RecordsBrowserColumns.tsx`
- Create: `apps/web/src/features/records/components/RecordsBrowserFilters.tsx`
- Create: `apps/web/src/features/records/components/RecordsBrowserRowActions.tsx`
- Create: `apps/web/src/features/records/components/RecordDetailDrawer.tsx`
- Create: `apps/web/src/app/routes/_auth/records.tsx`

按 spec §4.3 严格拆 4 个 RecordsBrowser 文件。

### 5.5.1 浏览页能力

- 顶部筛选条：项目下拉 + 垂线下拉 + 日期范围 + 杯号搜
- 表格列：日期 / 项目 / 垂线 / 水深 / 6 点位含沙量 / 平均含沙量 / 操作
- 分页：offset（"上一页/下一页/Goto Page"）
- 行操作：详情（drawer 看完整 points + 导出该行）/ 删除（admin）
- 导出：当前筛选下 `GET /records/export` 流式下载 CSV

### 5.5.2 RecordDetailDrawer

显示完整 18 字段 points + 元数据，可拷贝 client_uid。

- [ ] **Step 1-9:** 写代码 + 测试 + 提交

```bash
git commit -m "feat(records): 数据浏览页 + 详情 drawer + CSV 导出"
```

---

## Task 5.6 · 把 weighing.tsx 切到真 BE + 实时联动

**Files:**
- Modify: `apps/web/src/app/routes/weighing.tsx`
- Modify: `apps/web/src/features/weighing/components/RecordsTable.tsx`（接真 API）
- Modify: `apps/web/src/features/weighing/components/ConfigPanel.tsx`（项目/垂线/杯号下拉接真 API）
- Create: `apps/web/src/features/weighing/api.ts`
- Create: `apps/web/src/features/weighing/hooks.ts`
- Delete: `apps/web/src/features/weighing/mock-data.ts`（删！）

### 5.6.1 weighing/api.ts

```ts
export const submitRecord = (body: RecordCreate): Promise<Record> =>
  api.post<Record>('/records/', body).then((r) => r.data);

export const fetchRecordsByFilter = (params: {
  project_id?: number; vertical_id?: number; date_from?: string; date_to?: string;
  cursor?: string | null; limit?: number;
}): Promise<CursorPageRecord> => api.get('/records/', { params }).then((r) => r.data);
```

### 5.6.2 weighing/hooks.ts

```ts
export const useWeighingRecordsLive = (filter: { project_id?: number; vertical_id?: number }) =>
  useInfiniteQuery({
    queryKey: ['records', 'weighing', filter],
    queryFn: ({ pageParam }) => fetchRecordsByFilter({ ...filter, cursor: pageParam ?? null, limit: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    refetchInterval: 10_000,  // 10s 轮询多用户实时性（spec §9.3）
    enabled: filter.project_id !== undefined,
  });

export const useSubmitRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitRecord,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['records'] }),
  });
};
```

### 5.6.3 ConfigPanel 改造

把原来 select 的 mock 选项改成：
- 项目下拉 → `<ProjectCombobox value={cfg.project} onChange={p => onChange({ project: p })} />`
- 垂线下拉 → `useVerticalsByProject(projectId)`
- 杯号下拉 → 用 cups Combobox（接 `/cups?q=` 模糊搜）

### 5.6.4 RecordsTable 改造

```tsx
const { data: pages, isLoading } = useWeighingRecordsLive({
  project_id: filter.project_id, vertical_id: filter.vertical_id,
});
const rows = pages?.pages.flatMap((p) => p.items) ?? [];
```

URL search params 同步：`?project_id=X&vertical_id=Y`，`useSearchParams`。

### 5.6.5 录入逻辑

`onCommit`：
1. 状态 ready_to_commit 时，组装 RecordCreate（含 `client_uid: uuidv4()`）
2. 调 `useSubmitRecord` → 写入 IndexedDB 队列同时尝试 POST
3. 成功 → state 进 `committed` + `RESET_FOR_NEXT_POINT`
4. 失败 → 留在队列，UI 显示"待同步 N 条"

（队列 + worker 见 Task 5.7）

- [ ] **Step 1-8:** 改造 + 删 mock-data + 测试 + 提交

```bash
git commit -m "feat(weighing): 切到真 BE（项目/垂线/杯号实时下拉 + 左表 10s 轮询 + 录入幂等）"
```

---

## Task 5.7 · IndexedDB 离线队列 + SyncWorker（Web 端）

**Files:**
- Create: `apps/web/src/lib/queue/submission-queue.ts` （接口）
- Create: `apps/web/src/lib/queue/indexeddb-queue.ts`
- Create: `apps/web/src/lib/queue/sync-worker.ts`
- Create: `apps/web/src/features/weighing/components/PendingBanner.tsx` （顶部横幅显示队列长度）
- Test: `apps/web/src/lib/queue/indexeddb-queue.test.ts`

### 5.7.1 接口

```ts
export interface PendingItem {
  client_uid: string;
  payload: RecordCreate;
  status: 'pending' | 'syncing' | 'failed' | 'needs_review';
  attempt_count: number;
  last_error: string | null;
  created_at: number;
}

export interface SubmissionQueue {
  enqueue(item: Omit<PendingItem, 'status' | 'attempt_count' | 'last_error' | 'created_at'>): Promise<void>;
  drain(maxBatch: number): Promise<PendingItem[]>;
  markSynced(uids: string[]): Promise<void>;
  markFailed(uid: string, error: string, max_attempts: number): Promise<void>;
  count(): Promise<{ pending: number; needs_review: number }>;
}
```

### 5.7.2 IndexedDB 实现（用 idb-keyval 简化）

存一个 `pending_records` map（key=client_uid → PendingItem），api 包装。

### 5.7.3 SyncWorker

```ts
export function startSyncWorker(queue: SubmissionQueue): () => void {
  const tick = async () => {
    const items = await queue.drain(100);
    if (items.length === 0) return;
    const r = await api.post<BatchResponse>('/records/batch', { records: items.map((i) => i.payload) });
    const synced = r.data.results.filter((x) => x.status === 'created' || x.status === 'duplicate').map((x) => x.client_uid);
    await queue.markSynced(synced);
    for (const x of r.data.results.filter((x) => x.status === 'invalid')) {
      await queue.markFailed(x.client_uid, x.error ?? 'invalid', 5);
    }
  };
  const id = window.setInterval(() => void tick(), 30_000);
  window.addEventListener('online', () => void tick());
  void tick();
  return () => window.clearInterval(id);
}
```

### 5.7.4 PendingBanner

显示"队列中 N 条待同步"，点击展开列表，可手动触发 `tick`。

### 5.7.5 集成到 useSubmitRecord

```ts
mutationFn: async (body: RecordCreate) => {
  await queue.enqueue({ client_uid: body.client_uid, payload: body });
  await tick(); // 立即尝试一次
}
```

- [ ] **Step 1-8:** 写代码 + 测试 + 提交

```bash
git commit -m "feat(queue): IndexedDB 队列 + SyncWorker（30s + online 触发）+ PendingBanner"
```

---

## Task 5.8 · E2E 完整 12 条动线

**Files:**
- Modify: `apps/web/playwright.config.ts`（如需调整）
- Create: `apps/web/tests/e2e/global-setup.ts`（启 BE + seed admin）
- Create: `apps/web/tests/e2e/fixtures.ts` （登录 helper）
- Create: `apps/web/tests/e2e/01-auth.spec.ts`
- Create: `apps/web/tests/e2e/02-theme.spec.ts`
- Create: `apps/web/tests/e2e/03-records-filter-live.spec.ts`
- Create: `apps/web/tests/e2e/04-project-combobox.spec.ts`
- Create: `apps/web/tests/e2e/05-scale-probe.spec.ts`
- Create: `apps/web/tests/e2e/06-mock-stream.spec.ts`
- Create: `apps/web/tests/e2e/07-full-weighing.spec.ts`
- Create: `apps/web/tests/e2e/08-scales-crud.spec.ts`
- Create: `apps/web/tests/e2e/09-projects-cups-crud.spec.ts`
- Create: `apps/web/tests/e2e/10-records-browse-export.spec.ts`
- Create: `apps/web/tests/e2e/12-auth-refresh.spec.ts`

E2E-11（断网重连，桌面专属）放 Phase 6。

### 5.8.1 global-setup

启 docker compose pg + 启 api（uvicorn 18000）+ alembic upgrade + seed admin。

### 5.8.2 fixtures.ts

```ts
import { test as base } from '@playwright/test';
export const test = base.extend({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('input[id=username]', 'admin');
    await page.fill('input[id=password]', 'admin123!');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('/login'));
    await use(page);
  },
});
```

### 5.8.3 每个 spec 实现 spec §12.2 表格中的对应用例

每条用例都要：
- 用 `loggedInPage` fixture
- 关键断言（DOM + URL + toast + 表格行数等）
- dark / light 主题各跑一次（playwright.config 已配 2 project）

具体每条断言见 spec §12.2 表格。

- [ ] **Step 1-15:** 写 11 个 spec + 跑通 + 提交

```bash
git commit -m "test(e2e): 11 条 E2E 动线（除 E2E-11 桌面专属留 Phase 6）"
```

---

## Task 5.9 · 全量自检

- [ ] **Step 1:** 单元 + lint + typecheck + build

```bash
pnpm --filter @scale/web test
pnpm --filter @scale/web lint
pnpm --filter @scale/web typecheck
pnpm --filter @scale/web build
```

- [ ] **Step 2:** E2E（确保 docker pg + api 起着）

```bash
docker compose -f ../../scale-system/docker/docker-compose.yml up -d pg
cd ../../scale-system/apps/api && uv run alembic upgrade head && uv run python scripts/seed.py
cd ../../scale-system-fe-crud/apps/web && pnpm test:e2e
```

期望：全部 pass。

- [ ] **Step 3:** 提交

```bash
git commit --allow-empty -m "test: Phase 5 全量自检通过"
```

---

## Phase 5 完成标志

✅ 4 个 CRUD 管理页（projects/scales/cups/records）端到端
✅ ProjectCombobox infinite scroll
✅ 探测连接 dialog（用 Phase 4 的 mock 串口跑通）
✅ 率定历史 dialog + drawer
✅ 数据浏览页 + CSV 导出
✅ weighing.tsx 切真 BE + 10s 轮询 + URL 同步
✅ IndexedDB 队列 + SyncWorker + PendingBanner
✅ E2E 11 条全过（E2E-11 留 Phase 6）
✅ vitest + lint + typecheck + build 全绿

---

## 下一步

合 main，进入 Phase 8（如果还有未覆盖的 E2E）或 Phase 9（Docker 完整化）或最终验收。
