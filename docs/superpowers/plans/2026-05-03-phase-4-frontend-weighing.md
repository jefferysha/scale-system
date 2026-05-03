# Phase 4 · 前端采集页 React 复刻

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 3 已合并 main（含 Tailwind + tokens + AppShell + 路由）。Worktree：`../scale-system-fe-weighing` 分支 `phase-4/frontend-weighing`。

**Goal:** 把 `legacy/scale-system.html` 的采集页（三栏：数据表 / 天平 + 6 指标 + 垂线图 / 配置面板）100% 视觉复刻为 React 组件，严格按 spec §4.3 拆分，状态机 + mock 串口流接通 LCD，**暂用 mock 数据**（左表数据先用静态 mock，串口流用 mock 推送），等 Phase 5 接 BE。

**Architecture:** Feature-based。weighing feature 自包含；BalanceStage 拆 5 子组件；状态机拆 events + guards + machine；不直连 BE（Phase 5 做）。

**Tech Stack:** React 19 / Vite 6 / Tailwind v4 / shadcn / TanStack Query / Zustand / SVG 原生（不引图表库）。

---

## 关键约束（继承 Phase 3 偏差修正）

1. **每个 React 文件 ≤ 500 行**（ESLint 强制）。BalanceStage 必拆 5 子文件、机器必拆 events/guards/machine。
2. **不引入新 UI 框架**。所有视觉组件用 Tailwind + 现有 tokens（CSS 变量）。
3. **不直连 BE API**。所有数据来自 `lib/mock-data.ts`，串口流来自 `lib/serial/mock-serial.ts`（实现 SerialAdapter 接口的 mock 版）。
4. **暗/亮主题保持完整**。视觉与 `legacy/scale-system.html` 像素级对照。
5. **图片资源**：直接复用 `legacy/balance.png`（拷贝到 `apps/web/public/balance.png`）。
6. **不动 Phase 3 已建组件**（Header/NavMenu/StatusChip/LedDot/ThemeToggle）。

---

## Task 4.1 · 资源准备 + mock 串口流

**Files:**
- Create: `apps/web/public/balance.png`
- Create: `apps/web/src/lib/serial/mock-serial.ts`
- Modify: `apps/web/src/lib/platform.ts` （加 mock 选择逻辑，仅 `import.meta.env.DEV` 下生效）

- [ ] **Step 1:** 拷贝天平图

```bash
cp /Users/jiayin/Documents/code_manager/h-frontend/scale-system/legacy/balance.png apps/web/public/balance.png
```

注意：worktree 在 `../scale-system-fe-weighing/`，要从主仓 `../../scale-system/legacy/balance.png` 拷过来：

```bash
cp ../../scale-system/legacy/balance.png apps/web/public/balance.png
```

或直接从主仓绝对路径：`cp /Users/jiayin/Documents/code_manager/h-frontend/scale-system/legacy/balance.png apps/web/public/balance.png`

- [ ] **Step 2:** 写 `lib/serial/mock-serial.ts`

```ts
import type {
  ConnectionState,
  ProbeResult,
  ScaleConfig,
  SerialAdapter,
  SerialError,
  SerialPortInfo,
  WeightSample,
} from './adapter';

/**
 * 测试/演示用 mock SerialAdapter。
 * 启动后每 100ms emit 一个重量样本，权重在目标值附近抖动。
 * 5s 后稳定（stable=true）。
 */
export class MockSerialAdapter implements SerialAdapter {
  private weightHandlers = new Set<(s: WeightSample) => void>();
  private statusHandlers = new Set<(s: ConnectionState) => void>();
  private errorHandlers = new Set<(e: SerialError) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private opened = false;

  isSupported(): boolean {
    return true;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return [
      { id: 'mock-com3', label: 'MOCK COM3 (Mettler XS204)', vendor: 'Mock', product: 'XS204' },
      { id: 'mock-com4', label: 'MOCK COM4 (Sartorius Quintix224)', vendor: 'Mock', product: 'Quintix224' },
    ];
  }

  async open(_portId: string, _config: ScaleConfig): Promise<void> {
    this.opened = true;
    this.startedAt = Date.now();
    this.statusHandlers.forEach((h) => h('opening'));
    setTimeout(() => {
      if (!this.opened) return;
      this.statusHandlers.forEach((h) => h('connected'));
      this.statusHandlers.forEach((h) => h('reading'));
      this.timer = setInterval(() => this.emitSample(), 100);
    }, 250);
  }

  async close(): Promise<void> {
    this.opened = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.statusHandlers.forEach((h) => h('disconnected'));
  }

  onWeight(handler: (s: WeightSample) => void): () => void {
    this.weightHandlers.add(handler);
    return () => this.weightHandlers.delete(handler);
  }

  onStatus(handler: (s: ConnectionState) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onError(handler: (e: SerialError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  async probe(_portId: string, _config: ScaleConfig, timeoutMs: number): Promise<ProbeResult> {
    const samples: WeightSample[] = [];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && samples.length < 5) {
      await new Promise((r) => setTimeout(r, 100));
      samples.push(this.makeSample(false));
    }
    return { ok: true, samples };
  }

  private emitSample(): void {
    const sample = this.makeSample(Date.now() - this.startedAt > 5000);
    this.weightHandlers.forEach((h) => h(sample));
  }

  private makeSample(stable: boolean): WeightSample {
    const target = 168.4521;
    const noise = stable ? (Math.random() - 0.5) * 0.0008 : (Math.random() - 0.5) * 0.05;
    const value = Number((target + noise).toFixed(4));
    return {
      value,
      unit: 'g',
      stable,
      raw: `S ${stable ? 'S' : 'D'} ${value.toFixed(4)} g\r\n`,
      ts: Date.now(),
    };
  }
}
```

- [ ] **Step 3:** 改 `lib/platform.ts` 加 mock 选择

```ts
import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const isMockSerial = (): boolean =>
  import.meta.env.DEV &&
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === '1');

let cached: SerialAdapter | null = null;

export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  if (isMockSerial()) cached = new MockSerialAdapter();
  else if (isTauri()) cached = new UnsupportedSerialAdapter(); // Phase 6 替换为 TauriSerialAdapter
  else cached = new UnsupportedSerialAdapter(); // Phase 5 后会接 BrowserSerialAdapter
  return cached;
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};
```

- [ ] **Step 4:** 提交

```bash
git add apps/web/public/balance.png apps/web/src/lib/platform.ts apps/web/src/lib/serial/mock-serial.ts
git commit -m "feat(web): mock 串口 adapter + ?mock=1 启用切换 + 复用 balance.png"
```

---

## Task 4.2 · weighing feature 框架（types + mock-data + 状态机骨架）

**Files:**
- Create: `apps/web/src/features/weighing/types.ts`
- Create: `apps/web/src/features/weighing/mock-data.ts`
- Create: `apps/web/src/features/weighing/machine.ts`
- Create: `apps/web/src/features/weighing/machine.events.ts`
- Create: `apps/web/src/features/weighing/machine.guards.ts`
- Test: `apps/web/src/features/weighing/machine.test.ts`

- [ ] **Step 1:** 写 `features/weighing/types.ts`

```ts
export interface ProjectLite {
  id: number;
  name: string;
  established_date: string | null;
}

export interface VerticalLite {
  id: number;
  project_id: number;
  code: string;
  label: string | null;
}

export interface CupLite {
  id: number;
  cup_number: string;
  current_tare_g: number;
}

export type PointPosition = '0.0' | '0.2' | '0.4' | '0.6' | '0.8' | '1.0';

export interface PointDraft {
  pos: PointPosition;
  cup_id: number | null;
  cup_number: string | null;
  cup_tare_g: number | null;
  wet_weight_g: number | null;
  concentration_mg_l: number | null;
  weighed_at: string | null;
}

export interface WeighingConfig {
  project: ProjectLite | null;
  vertical: VerticalLite | null;
  bottle: 1000 | 500 | 250;
  volume_ml: number;
  water_depth_m: number | null;
  tide_type: '大潮' | '小潮' | '平潮' | null;
  start_time: string | null;
  current_pos: PointPosition;
  current_cup: CupLite | null;
  target_wet_weight_g: number | null;
}
```

- [ ] **Step 2:** 写 `features/weighing/mock-data.ts`

```ts
import type { CupLite, ProjectLite, VerticalLite } from './types';

export const MOCK_PROJECTS: ProjectLite[] = [
  { id: 1, name: 'S徐六泾断面定线比测202603', established_date: '2026-03-01' },
  { id: 2, name: 'S浙江201611', established_date: '2016-11-13' },
  { id: 3, name: 'S徐六泾断面200712', established_date: '2007-12-24' },
];

export const MOCK_VERTICALS: VerticalLite[] = [
  { id: 1, project_id: 1, code: 'V-01', label: '徐六泾左岸' },
  { id: 2, project_id: 1, code: 'V-02', label: null },
  { id: 3, project_id: 1, code: 'V-03', label: null },
  { id: 4, project_id: 1, code: 'V-04', label: null },
  { id: 5, project_id: 1, code: 'V-05', label: '徐六泾右岸' },
];

export const MOCK_CUPS: CupLite[] = [
  { id: 1024, cup_number: 'C-1024', current_tare_g: 35.248 },
  { id: 1025, cup_number: 'C-1025', current_tare_g: 35.671 },
  { id: 325, cup_number: '325', current_tare_g: 50.6112 },
];

export const MOCK_RECORDS = [
  // 复刻 Excel 中 1 行结构，便于左表展示
  {
    id: 1,
    project_id: 1,
    vertical_id: 1,
    sample_date: '2026-05-02',
    water_depth_m: 9.4,
    points: [
      { pos: '0.0', cup_number: '325', wet_weight_g: 45.1008, concentration_mg_l: 0.3109 },
      { pos: '0.2', cup_number: '207', wet_weight_g: 70.0226, concentration_mg_l: 0.3384 },
      { pos: '0.4', cup_number: '219', wet_weight_g: 51.0602, concentration_mg_l: 0.3281 },
      { pos: '0.6', cup_number: '564', wet_weight_g: 47.7411, concentration_mg_l: 0.3226 },
      { pos: '0.8', cup_number: '339', wet_weight_g: 49.7393, concentration_mg_l: 0.3578 },
      { pos: '1.0', cup_number: '333', wet_weight_g: 50.611, concentration_mg_l: 0.3516 },
    ],
    computed_avg_concentration: 0.3349,
  },
];
```

- [ ] **Step 3:** 写 `features/weighing/machine.events.ts`

```ts
import type { PointPosition, WeighingConfig } from './types';

export type WeighingState =
  | { kind: 'idle' }
  | { kind: 'configured'; config: WeighingConfig }
  | { kind: 'capturing'; config: WeighingConfig; samples: number; lastValue: number; stable: boolean }
  | { kind: 'ready_to_commit'; config: WeighingConfig; finalValue: number }
  | { kind: 'committed'; config: WeighingConfig; pos: PointPosition; finalValue: number };

export type WeighingEvent =
  | { type: 'CONFIGURE'; config: WeighingConfig }
  | { type: 'START_CAPTURE' }
  | { type: 'WEIGHT_SAMPLE'; value: number; stable: boolean }
  | { type: 'COMMIT' }
  | { type: 'RESET_FOR_NEXT_POINT'; nextPos: PointPosition }
  | { type: 'ABORT' };

export const STABLE_REQUIRED_SAMPLES = 5;
```

- [ ] **Step 4:** 写 `features/weighing/machine.guards.ts`

```ts
import type { WeighingConfig } from './types';

export const hasFullConfig = (cfg: Partial<WeighingConfig>): cfg is WeighingConfig => {
  return Boolean(
    cfg.project &&
      cfg.vertical &&
      cfg.bottle &&
      cfg.volume_ml &&
      cfg.current_pos &&
      cfg.current_cup,
  );
};

export const isStable = (samples: number, stable: boolean): boolean => {
  return stable && samples >= 5;
};
```

- [ ] **Step 5:** 写 `features/weighing/machine.ts` （reducer 风格）

```ts
import type { WeighingEvent, WeighingState } from './machine.events';
import { isStable } from './machine.guards';

export function weighingReducer(state: WeighingState, event: WeighingEvent): WeighingState {
  switch (event.type) {
    case 'CONFIGURE':
      return { kind: 'configured', config: event.config };

    case 'START_CAPTURE':
      if (state.kind !== 'configured') return state;
      return {
        kind: 'capturing',
        config: state.config,
        samples: 0,
        lastValue: 0,
        stable: false,
      };

    case 'WEIGHT_SAMPLE': {
      if (state.kind !== 'capturing') return state;
      const samples = state.samples + 1;
      const next: WeighingState = {
        kind: 'capturing',
        config: state.config,
        samples,
        lastValue: event.value,
        stable: event.stable,
      };
      if (isStable(samples, event.stable)) {
        return { kind: 'ready_to_commit', config: state.config, finalValue: event.value };
      }
      return next;
    }

    case 'COMMIT':
      if (state.kind !== 'ready_to_commit') return state;
      return {
        kind: 'committed',
        config: state.config,
        pos: state.config.current_pos,
        finalValue: state.finalValue,
      };

    case 'RESET_FOR_NEXT_POINT':
      if (state.kind === 'idle') return state;
      return {
        kind: 'configured',
        config: { ...state.config, current_pos: event.nextPos } as WeighingState extends { config: infer C } ? C : never,
      };

    case 'ABORT':
      return { kind: 'idle' };
  }
}

export const initialWeighingState: WeighingState = { kind: 'idle' };
```

- [ ] **Step 6:** 写测试 `features/weighing/machine.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { initialWeighingState, weighingReducer } from './machine';
import type { WeighingConfig } from './types';

const cfg: WeighingConfig = {
  project: { id: 1, name: 'P', established_date: null },
  vertical: { id: 1, project_id: 1, code: 'V', label: null },
  bottle: 1000,
  volume_ml: 500,
  water_depth_m: 9.4,
  tide_type: null,
  start_time: null,
  current_pos: '0.0',
  current_cup: { id: 1, cup_number: 'C', current_tare_g: 35.0 },
  target_wet_weight_g: 100,
};

describe('weighingReducer', () => {
  it('starts idle', () => {
    expect(initialWeighingState.kind).toBe('idle');
  });

  it('CONFIGURE → configured', () => {
    const s = weighingReducer(initialWeighingState, { type: 'CONFIGURE', config: cfg });
    expect(s.kind).toBe('configured');
  });

  it('START_CAPTURE only from configured', () => {
    const s1 = weighingReducer(initialWeighingState, { type: 'START_CAPTURE' });
    expect(s1.kind).toBe('idle');
    const s2 = weighingReducer({ kind: 'configured', config: cfg }, { type: 'START_CAPTURE' });
    expect(s2.kind).toBe('capturing');
  });

  it('5 stable samples → ready_to_commit', () => {
    let s: ReturnType<typeof weighingReducer> = { kind: 'capturing', config: cfg, samples: 0, lastValue: 0, stable: false };
    for (let i = 0; i < 5; i++) {
      s = weighingReducer(s, { type: 'WEIGHT_SAMPLE', value: 99.9999, stable: true });
    }
    expect(s.kind).toBe('ready_to_commit');
  });

  it('COMMIT requires ready_to_commit', () => {
    const s1 = weighingReducer({ kind: 'configured', config: cfg }, { type: 'COMMIT' });
    expect(s1.kind).toBe('configured'); // 不变
    const s2 = weighingReducer({ kind: 'ready_to_commit', config: cfg, finalValue: 100 }, { type: 'COMMIT' });
    expect(s2.kind).toBe('committed');
  });
});
```

- [ ] **Step 7:** 跑测试 + lint

```bash
pnpm --filter @scale/web test
pnpm --filter @scale/web lint
```

- [ ] **Step 8:** 提交

```bash
git add apps/web/src/features/weighing/
git commit -m "feat(weighing): types + mock-data + 状态机（events/guards/reducer + 测试）"
```

---

## Task 4.3 · BalanceStage 组件树（5 子组件）

**Files:**
- Create: `apps/web/src/features/weighing/components/BalanceStage.tsx`
- Create: `apps/web/src/features/weighing/components/BalanceImage.tsx`
- Create: `apps/web/src/features/weighing/components/LCDDisplay.tsx`
- Create: `apps/web/src/features/weighing/components/ConnectionStatusBadge.tsx`
- Create: `apps/web/src/features/weighing/components/SamplesHealthIndicator.tsx`
- Create: `apps/web/src/stores/scale-stream-store.ts`

### 4.3.1 stores/scale-stream-store.ts

按 spec §3 + §9.7：

```ts
import { create } from 'zustand';
import type { ConnectionState, WeightSample } from '@/lib/serial/adapter';

interface ScaleStreamState {
  connection: ConnectionState;
  lastWeight: WeightSample | null;
  error: { code: string; message: string } | null;
  samplesPerSec: number;
  _samplesIn1s: number;
  _windowStart: number;
  setConnection: (c: ConnectionState) => void;
  pushSample: (s: WeightSample) => void;
  setError: (e: { code: string; message: string } | null) => void;
  reset: () => void;
}

export const useScaleStreamStore = create<ScaleStreamState>((set, get) => ({
  connection: 'idle',
  lastWeight: null,
  error: null,
  samplesPerSec: 0,
  _samplesIn1s: 0,
  _windowStart: Date.now(),
  setConnection: (c) => set({ connection: c }),
  pushSample: (s) => {
    const now = Date.now();
    const st = get();
    let inWin = st._samplesIn1s + 1;
    let winStart = st._windowStart;
    if (now - winStart >= 1000) {
      const sps = inWin;
      inWin = 0;
      winStart = now;
      set({ samplesPerSec: sps });
    }
    set({ lastWeight: s, _samplesIn1s: inWin, _windowStart: winStart });
  },
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      connection: 'idle',
      lastWeight: null,
      error: null,
      samplesPerSec: 0,
      _samplesIn1s: 0,
      _windowStart: Date.now(),
    }),
}));
```

### 4.3.2 ConnectionStatusBadge.tsx（< 80 行）

按连接状态显示不同颜色徽章，复用 Phase 3 的 `StatusChip`：

```tsx
import { StatusChip } from '@/components/domain/StatusChip';
import type { ConnectionState } from '@/lib/serial/adapter';

const labelMap: Record<ConnectionState, string> = {
  idle: '待机',
  opening: '连接中',
  connected: '已连接',
  reading: '采集中',
  error: '错误',
  disconnected: '已断开',
};

const variantMap: Record<ConnectionState, 'default' | 'success' | 'warn' | 'danger'> = {
  idle: 'default',
  opening: 'warn',
  connected: 'success',
  reading: 'success',
  error: 'danger',
  disconnected: 'default',
};

export function ConnectionStatusBadge({ state }: { state: ConnectionState }): React.ReactElement {
  return (
    <StatusChip
      label={labelMap[state]}
      variant={variantMap[state]}
      pulse={state === 'reading' || state === 'opening'}
    />
  );
}
```

### 4.3.3 LCDDisplay.tsx（< 100 行）

```tsx
import { cn } from '@/lib/utils';

interface Props {
  digits: string;
  unit?: string;
  stable?: boolean;
  className?: string;
}

export function LCDDisplay({ digits, unit = 'g', stable = false, className }: Props): React.ReactElement {
  return (
    <div
      className={cn(
        'absolute left-1/2 top-[42%] flex -translate-x-1/2 items-baseline gap-2 font-mono text-2xl tabular-nums',
        'rounded-md border border-[var(--line-2)] bg-black/60 px-3 py-1 text-[var(--acc)]',
        stable && 'shadow-[var(--led-glow)]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn('size-1.5 rounded-full bg-[var(--acc)]', stable ? '' : 'opacity-30')} />
      <span>{digits}</span>
      <span className="text-xs">{unit}</span>
    </div>
  );
}
```

### 4.3.4 BalanceImage.tsx（< 60 行）

```tsx
import { LCDDisplay } from './LCDDisplay';

interface Props {
  digits: string;
  stable: boolean;
}

export function BalanceImage({ digits, stable }: Props): React.ReactElement {
  return (
    <div className="relative grid place-items-center">
      <img src="/balance.png" alt="电子天平" className="max-h-[420px] w-auto select-none" draggable={false} />
      <LCDDisplay digits={digits} stable={stable} />
    </div>
  );
}
```

### 4.3.5 SamplesHealthIndicator.tsx（< 60 行）

```tsx
import { cn } from '@/lib/utils';

export function SamplesHealthIndicator({ sps }: { sps: number }): React.ReactElement {
  const tone = sps >= 3 ? 'text-[var(--acc)]' : sps >= 1 ? 'text-[var(--warn)]' : 'text-[var(--danger)]';
  return (
    <span className={cn('font-mono text-[10px] tracking-wider', tone)} title="样本/秒">
      {sps} sps
    </span>
  );
}
```

### 4.3.6 BalanceStage.tsx（容器 < 150 行）

```tsx
import { useEffect } from 'react';
import { BalanceImage } from './BalanceImage';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { SamplesHealthIndicator } from './SamplesHealthIndicator';
import { useScaleStreamStore } from '@/stores/scale-stream-store';
import { getSerialAdapter } from '@/lib/platform';

export function BalanceStage(): React.ReactElement {
  const { connection, lastWeight, samplesPerSec, setConnection, pushSample, setError } =
    useScaleStreamStore();

  useEffect(() => {
    const adapter = getSerialAdapter();
    const offW = adapter.onWeight(pushSample);
    const offS = adapter.onStatus(setConnection);
    const offE = adapter.onError(setError);
    return () => {
      offW();
      offS();
      offE();
    };
  }, [pushSample, setConnection, setError]);

  const digits = lastWeight ? lastWeight.value.toFixed(4) : '0.0000';
  const stable = lastWeight?.stable ?? false;

  return (
    <section className="relative flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[var(--bg-2)] p-4">
      <header className="flex items-center justify-between">
        <ConnectionStatusBadge state={connection} />
        <span className="text-xs text-[var(--text-3)]">实时</span>
      </header>
      <BalanceImage digits={digits} stable={stable} />
      <footer className="flex justify-end">
        <SamplesHealthIndicator sps={samplesPerSec} />
      </footer>
    </section>
  );
}
```

- [ ] **Step 1-7:** 写 6 个文件 + 提交

```bash
git add apps/web/src/stores/scale-stream-store.ts apps/web/src/features/weighing/components/
git commit -m "feat(weighing): BalanceStage 拆 5 子组件 + scale-stream-store"
```

---

## Task 4.4 · PointGrid（6 指标卡）

**Files:**
- Create: `apps/web/src/features/weighing/components/PointGrid.tsx`

```tsx
import { cn } from '@/lib/utils';
import type { PointDraft } from '../types';

interface Props {
  /** 当前实时重量（含沙量待 commit 才填） */
  liveWeight: number;
  liveStable: boolean;
  /** 当前选中点位 */
  currentPos: string;
  /** 已录入的点位结果 */
  committedPoints: PointDraft[];
  /** 配置元信息 */
  cupNumber: string | null;
  cupTareG: number | null;
  volumeMl: number;
}

export function PointGrid({
  liveWeight, liveStable, currentPos, committedPoints, cupNumber, cupTareG, volumeMl,
}: Props): React.ReactElement {
  const sandG = cupTareG !== null ? liveWeight - cupTareG : null;
  const liveConcMgL = sandG !== null && volumeMl > 0 ? (sandG / volumeMl) * 1000 : null;

  const cells = [
    {
      label: '天平数据',
      value: liveWeight.toFixed(4),
      unit: 'g',
      delta: liveStable ? '稳定' : '采集中',
      accent: true,
    },
    { label: '杯号', value: cupNumber ?? '—', unit: '', delta: `当前 ${currentPos}` },
    {
      label: '杯沙重',
      value: liveWeight.toFixed(4),
      unit: 'g',
      delta: '湿重',
    },
    {
      label: '杯重',
      value: cupTareG !== null ? cupTareG.toFixed(4) : '0.0000',
      unit: 'g',
      delta: '来自杯重本',
    },
    {
      label: '泥沙重',
      value: sandG !== null ? sandG.toFixed(4) : '0.0000',
      unit: 'g',
      delta: '杯沙重 减 杯重',
    },
    {
      label: '含沙量',
      value: liveConcMgL !== null ? liveConcMgL.toFixed(1) : '0.0',
      unit: 'mg/L',
      delta: '泥沙重 除 容积',
      accent: true,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
      {cells.map((c) => (
        <div
          key={c.label}
          className={cn(
            'flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3',
            c.accent && 'border-[var(--acc)]/40 bg-[var(--acc-shade)]',
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">{c.label}</span>
          <span className="font-mono text-base tabular-nums text-[var(--text)]">
            {c.value}
            {c.unit && <span className="ml-1 text-xs text-[var(--text-2)]">{c.unit}</span>}
          </span>
          <span className="text-[10px] text-[var(--text-3)]">{c.delta}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 1:** 写组件 + 提交

```bash
git add apps/web/src/features/weighing/components/PointGrid.tsx
git commit -m "feat(weighing): PointGrid 6 指标卡（实时含沙量计算）"
```

---

## Task 4.5 · VerticalLineViz（垂线 SVG）

**Files:**
- Create: `apps/web/src/features/weighing/components/VerticalLineViz.tsx`

按 `legacy/scale-system.html` 中 `viz-svg` 的视觉复刻：纵向条状代表水深，6 个圆点代表 6 个点位，已录入的实心，当前的高亮，未录入的灰色。

```tsx
import { cn } from '@/lib/utils';

interface Props {
  positions: string[]; // ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0']
  current: string;
  committed: Set<string>;
  waterDepthM: number | null;
}

export function VerticalLineViz({ positions, current, committed, waterDepthM }: Props): React.ReactElement {
  const W = 560;
  const H = 200;
  const pad = 30;
  const xCenter = W / 2;
  const top = pad;
  const bottom = H - pad;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-2">
      <header className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-[var(--text-2)]">垂线示意图</span>
        <span className="font-mono text-[10px] text-[var(--text-3)]">
          六点位 0.0 → 1.0 · 水深 {waterDepthM ?? '—'} m
        </span>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full">
        {/* 垂线 */}
        <line x1={xCenter} y1={top} x2={xCenter} y2={bottom} stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
        {/* 水面 */}
        <line x1={xCenter - 60} y1={top} x2={xCenter + 60} y2={top} stroke="var(--info)" strokeWidth={1.5} />
        <text x={xCenter + 70} y={top + 4} fill="var(--text-3)" fontSize="10" fontFamily="monospace">水面</text>
        {/* 河床 */}
        <line x1={xCenter - 60} y1={bottom} x2={xCenter + 60} y2={bottom} stroke="var(--warn)" strokeWidth={1.5} />
        <text x={xCenter + 70} y={bottom + 4} fill="var(--text-3)" fontSize="10" fontFamily="monospace">河床</text>
        {/* 6 个点位 */}
        {positions.map((p, i) => {
          const y = top + ((bottom - top) * i) / (positions.length - 1);
          const isCurrent = p === current;
          const isDone = committed.has(p);
          return (
            <g key={p}>
              <circle
                cx={xCenter}
                cy={y}
                r={isCurrent ? 8 : 6}
                fill={isDone ? 'var(--acc)' : isCurrent ? 'var(--acc-2)' : 'var(--bg-3)'}
                stroke={isCurrent ? 'var(--acc-2)' : 'var(--line-2)'}
                strokeWidth={isCurrent ? 2 : 1}
                className={cn(isCurrent && 'animate-pulse')}
              />
              <text
                x={xCenter + 16}
                y={y + 4}
                fill={isCurrent ? 'var(--acc-2)' : 'var(--text-2)'}
                fontSize="11"
                fontFamily="monospace"
              >
                {p}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 1:** 写组件 + 提交

```bash
git add apps/web/src/features/weighing/components/VerticalLineViz.tsx
git commit -m "feat(weighing): VerticalLineViz SVG（已录/当前/待采视觉区分）"
```

---

## Task 4.6 · ConfigPanel（右侧称重设置）

**Files:**
- Create: `apps/web/src/features/weighing/components/ConfigPanel.tsx`

复刻 `legacy/scale-system.html` 右侧"称重设置"面板：项目下拉、垂线下拉、容积、瓶型、水深、点次、杯号、杯重、目标湿重。先用 mock 数据填下拉。

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MOCK_CUPS, MOCK_PROJECTS, MOCK_VERTICALS } from '../mock-data';
import type { WeighingConfig } from '../types';

interface Props {
  config: Partial<WeighingConfig>;
  onChange: (cfg: Partial<WeighingConfig>) => void;
  onStart: () => void;
  onCommit: () => void;
  canStart: boolean;
  canCommit: boolean;
}

export function ConfigPanel({ config, onChange, onStart, onCommit, canStart, canCommit }: Props): React.ReactElement {
  const [bottle, setBottle] = useState<1000 | 500 | 250>(config.bottle ?? 1000);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">称重设置</h3>

      <div className="space-y-2">
        <Label>称重项目</Label>
        <select
          className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
          value={config.project?.id ?? ''}
          onChange={(e) => {
            const p = MOCK_PROJECTS.find((x) => x.id === Number(e.target.value)) ?? null;
            onChange({ ...config, project: p, vertical: null });
          }}
        >
          <option value="">选择项目</option>
          {MOCK_PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>垂线号</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={config.vertical?.id ?? ''}
            disabled={!config.project}
            onChange={(e) => {
              const v = MOCK_VERTICALS.find((x) => x.id === Number(e.target.value)) ?? null;
              onChange({ ...config, vertical: v });
            }}
          >
            <option value="">—</option>
            {MOCK_VERTICALS.filter((v) => v.project_id === config.project?.id).map((v) => (
              <option key={v.id} value={v.id}>{v.code}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>容积 mL</Label>
          <Input
            type="number"
            value={config.volume_ml ?? 500}
            onChange={(e) => onChange({ ...config, volume_ml: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>瓶型</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={bottle}
            onChange={(e) => {
              const b = Number(e.target.value) as 1000 | 500 | 250;
              setBottle(b);
              onChange({ ...config, bottle: b });
            }}
          >
            <option value="1000">1000</option>
            <option value="500">500</option>
            <option value="250">250</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>水深 m</Label>
          <Input
            type="number"
            step="0.1"
            value={config.water_depth_m ?? ''}
            onChange={(e) => onChange({ ...config, water_depth_m: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>点次</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={config.current_pos ?? '0.0'}
            onChange={(e) =>
              onChange({ ...config, current_pos: e.target.value as WeighingConfig['current_pos'] })
            }
          >
            {['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>杯号</Label>
          <select
            className="w-full rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-2 text-sm"
            value={config.current_cup?.id ?? ''}
            onChange={(e) => {
              const c = MOCK_CUPS.find((x) => x.id === Number(e.target.value)) ?? null;
              onChange({ ...config, current_cup: c });
            }}
          >
            <option value="">—</option>
            {MOCK_CUPS.map((c) => (
              <option key={c.id} value={c.id}>{c.cup_number}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>杯重 g</Label>
          <Input value={config.current_cup?.current_tare_g ?? 0} readOnly />
        </div>
        <div className="space-y-2">
          <Label>目标湿重 g</Label>
          <Input
            type="number"
            value={config.target_wet_weight_g ?? ''}
            onChange={(e) => onChange({ ...config, target_wet_weight_g: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button className="flex-1" onClick={onStart} disabled={!canStart}>开始称重</Button>
        <Button className="flex-1" variant="outline" onClick={onCommit} disabled={!canCommit}>录入</Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 1:** 写组件 + 提交

```bash
git add apps/web/src/features/weighing/components/ConfigPanel.tsx
git commit -m "feat(weighing): ConfigPanel 复刻右侧设置区（mock 项目/垂线/杯号下拉）"
```

---

## Task 4.7 · RecordsTable（左侧数据表，先 mock）

**Files:**
- Create: `apps/web/src/features/weighing/components/RecordsTable.tsx`

复刻左表：日期·时间 / 项目 / 杯号 / 水深 / 0.0~1.0 / 含沙量 / 操作 12 列。

```tsx
import { MOCK_RECORDS } from '../mock-data';

export function RecordsTable(): React.ReactElement {
  const rows = MOCK_RECORDS;
  return (
    <section className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">数据表格</h3>
        <span className="text-xs text-[var(--text-3)]">合计 {rows.length} 条</span>
      </header>
      <div className="overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="bg-[var(--bg-2)] text-[var(--text-3)]">
            <tr>
              <th className="px-2 py-1 text-left">日期</th>
              <th className="px-2 py-1 text-left">项目</th>
              <th className="px-2 py-1 text-right">水深</th>
              {['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'].map((p) => (
                <th key={p} className="px-2 py-1 text-right">{p}</th>
              ))}
              <th className="px-2 py-1 text-right">含沙量</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-2 py-4 text-center text-[var(--text-3)]">
                  暂无记录
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)]">
                  <td className="px-2 py-1">{r.sample_date}</td>
                  <td className="px-2 py-1 truncate" title={String(r.project_id)}>P-{r.project_id}</td>
                  <td className="px-2 py-1 text-right">{r.water_depth_m}</td>
                  {r.points.map((p) => (
                    <td key={p.pos} className="px-2 py-1 text-right">
                      {p.concentration_mg_l.toFixed(4)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-[var(--acc)]">
                    {r.computed_avg_concentration?.toFixed(4) ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 1:** 写组件 + 提交

```bash
git add apps/web/src/features/weighing/components/RecordsTable.tsx
git commit -m "feat(weighing): RecordsTable 复刻左侧数据表（mock 数据）"
```

---

## Task 4.8 · 采集页路由整合

**Files:**
- Create: `apps/web/src/app/routes/weighing.tsx`
- Modify: `apps/web/src/app/router.tsx` 加路由
- Modify: `apps/web/src/app/routes/index.tsx` 改重定向到 /weighing

- [ ] **Step 1:** 写 `app/routes/weighing.tsx`

```tsx
import { useReducer, useState } from 'react';
import { BalanceStage } from '@/features/weighing/components/BalanceStage';
import { ConfigPanel } from '@/features/weighing/components/ConfigPanel';
import { PointGrid } from '@/features/weighing/components/PointGrid';
import { RecordsTable } from '@/features/weighing/components/RecordsTable';
import { VerticalLineViz } from '@/features/weighing/components/VerticalLineViz';
import { initialWeighingState, weighingReducer } from '@/features/weighing/machine';
import { hasFullConfig } from '@/features/weighing/machine.guards';
import type { WeighingConfig } from '@/features/weighing/types';
import { useScaleStreamStore } from '@/stores/scale-stream-store';
import { getSerialAdapter } from '@/lib/platform';

const POSITIONS = ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'];

export default function WeighingPage(): React.ReactElement {
  const [config, setConfig] = useState<Partial<WeighingConfig>>({
    bottle: 1000,
    volume_ml: 500,
    current_pos: '0.0',
  });
  const [state, dispatch] = useReducer(weighingReducer, initialWeighingState);
  const { lastWeight, connection } = useScaleStreamStore();
  const [committedPositions] = useState<Set<string>>(new Set());

  const canStart = hasFullConfig(config) && state.kind === 'configured';
  const canCommit = state.kind === 'ready_to_commit';

  const onStart = async (): Promise<void> => {
    if (!hasFullConfig(config)) return;
    dispatch({ type: 'CONFIGURE', config });
    const adapter = getSerialAdapter();
    if (adapter.isSupported()) {
      await adapter.open('mock-com3', {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: 'none',
        protocolType: 'generic',
        readTimeoutMs: 1000,
        decimalPlaces: 4,
        unitDefault: 'g',
      });
    }
    dispatch({ type: 'START_CAPTURE' });
  };

  const onCommit = (): void => {
    dispatch({ type: 'COMMIT' });
  };

  return (
    <div className="grid h-full grid-cols-[1.7fr_0.92fr_0.42fr] gap-2 p-2">
      <RecordsTable />
      <div className="flex flex-col gap-2">
        <BalanceStage />
        <PointGrid
          liveWeight={lastWeight?.value ?? 0}
          liveStable={lastWeight?.stable ?? false}
          currentPos={config.current_pos ?? '0.0'}
          committedPoints={[]}
          cupNumber={config.current_cup?.cup_number ?? null}
          cupTareG={config.current_cup?.current_tare_g ?? null}
          volumeMl={config.volume_ml ?? 500}
        />
        <VerticalLineViz
          positions={POSITIONS}
          current={config.current_pos ?? '0.0'}
          committed={committedPositions}
          waterDepthM={config.water_depth_m ?? null}
        />
      </div>
      <ConfigPanel
        config={config}
        onChange={(cfg) => {
          setConfig(cfg);
          if (hasFullConfig(cfg)) dispatch({ type: 'CONFIGURE', config: cfg });
        }}
        onStart={onStart}
        onCommit={onCommit}
        canStart={canStart}
        canCommit={canCommit}
      />
    </div>
  );
}
```

- [ ] **Step 2:** 改 `app/router.tsx` 加路由

```tsx
import WeighingPage from './routes/weighing';
// ...
{ path: '/weighing', element: <WeighingPage /> },
```

- [ ] **Step 3:** 改 `app/routes/index.tsx` 改成跳 /weighing 或保留导航占位（开发期保留导航更方便）

- [ ] **Step 4:** 跑

```bash
pnpm dev
# 浏览器访问 http://localhost:5173/weighing?mock=1
# 验证：
# 1. 三栏布局正确显示
# 2. 选完配置点"开始称重"后 LCD 数字开始跳动
# 3. 5s 后 stable led 亮
# 4. 状态徽章颜色随状态变化
```

- [ ] **Step 5:** 提交

```bash
git add apps/web/src/app/routes/weighing.tsx apps/web/src/app/router.tsx apps/web/src/app/routes/index.tsx
git commit -m "feat(weighing): 采集页路由整合（三栏 + mock 数据 + ?mock=1 启用 mock 串口）"
```

---

## Task 4.9 · E2E 用例（采集页核心动线）

**Files:**
- Create: `apps/web/tests/e2e/weighing.spec.ts`

按 spec §12.2 的 E2E-06 / E2E-07：

```ts
import { test, expect } from '@playwright/test';

test.describe('采集页（mock 串口）', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟登录后访问 → 直接 jump 到采集页带 mock
    // Phase 5 接 BE 后这里改成真实登录；当前直接绕过 RequireAuth
    await page.goto('/weighing?mock=1');
  });

  test('三栏布局可见', async ({ page }) => {
    await expect(page.getByText('数据表格')).toBeVisible();
    await expect(page.getByText('称重设置')).toBeVisible();
    await expect(page.getByText('六点位 0.0 → 1.0')).toBeVisible();
  });

  test('mock 串口流入 LCD 实时更新', async ({ page }) => {
    // 选项目/垂线/杯号
    await page.locator('select').first().selectOption('1'); // 项目
    await page.waitForTimeout(100);
    // ...（按 ConfigPanel 顺序选完）
    // 点开始
    await page.getByRole('button', { name: '开始称重' }).click();
    // 5s 内应有 LCD 跳动
    const lcdBefore = await page.getByRole('status').first().textContent();
    await page.waitForTimeout(800);
    const lcdAfter = await page.getByRole('status').first().textContent();
    expect(lcdAfter).not.toBe(lcdBefore); // 数字在变
  });
});
```

注意：这阶段没接 BE，无法登录。临时方案：在 `tests/e2e/weighing.spec.ts` 顶部用 `test.use({ storageState: ... })` 注入一个 fake auth state，或者直接修改 RequireAuth 在 `?e2e=1` 时跳过（**不推荐**）。

**最稳妥的方案**：本 phase 的 E2E 暂时只验"未登录跳 /login + 登录页有正确字段"（已有冒烟用例覆盖）+ "三栏布局组件渲染（直接渲染组件而非走路由）"。完整采集动线 E2E 留到 Phase 5（接 BE 后能真登录）再加。

简化为本 phase E2E：

```ts
import { test, expect } from '@playwright/test';

test('采集页 mock 模式三栏布局可见', async ({ page }) => {
  // 不走真路由，用 vite 直接打开 mock fixture html（如果做 fixture）
  // 或者本 phase 跳过 E2E，留到 Phase 5
  test.skip(true, 'Phase 5 接 BE 后再加完整 E2E');
});
```

实施时可暂时 `test.skip`，只确保 Phase 3 已有的冒烟用例不被破坏。`pnpm test:e2e` 仍跑 4 个 ✓。

- [ ] **Step 1:** 写 spec（含 skip 注释）+ 提交

```bash
git commit -m "test(weighing): E2E 占位（待 Phase 5 接 BE 后完整动线）"
```

---

## Task 4.10 · 全量自检

- [ ] **Step 1:** 跑全部检查

```bash
pnpm install                  # worktree 第一次
pnpm --filter @scale/web test
pnpm --filter @scale/web lint
pnpm --filter @scale/web typecheck
pnpm --filter @scale/web build
pnpm --filter @scale/web test:e2e
```

期望：全部 green。

- [ ] **Step 2:** 跑 dev 手动验证（如果 agent 环境支持启 server）

```bash
pnpm dev &
sleep 3
curl -s http://localhost:5173/weighing?mock=1 | head -3
kill %1
```

- [ ] **Step 3:** 视觉对比（截图，可选）

如果 agent 能开 Playwright，截图保存到 `apps/web/tests/snapshots/weighing-page.png`，与 `legacy/scale-system.html` 对比验证视觉相似。

- [ ] **Step 4:** 提交收尾

```bash
git commit --allow-empty -m "test(weighing): Phase 4 全量自检通过"
```

---

## Phase 4 完成标志

✅ mock 串口 adapter（启 100ms 推一帧 + 5s 后 stable）
✅ weighing types + mock-data + reducer 状态机（含测试）
✅ BalanceStage 拆 5 子组件（≤ 150 / ≤ 60 / ≤ 80 / ≤ 60 / ≤ 100 行）
✅ PointGrid 6 指标卡（实时含沙量计算）
✅ VerticalLineViz SVG（已录/当前/待采视觉）
✅ ConfigPanel 复刻右侧设置区
✅ RecordsTable 复刻左表（mock）
✅ 采集页路由 + 三栏布局接通
✅ vitest + lint + typecheck + build 全绿
✅ E2E 占位（Phase 5 接 BE 后补完整动线）

---

## 下一步

合 main，等 Phase 2（BE 业务）也合后进入 Phase 5（前端 CRUD + 接真 BE + 完整 E2E 动线）。
