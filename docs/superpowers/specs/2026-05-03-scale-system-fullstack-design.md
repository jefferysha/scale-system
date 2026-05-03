# 天平称重系统 · 前后端分离架构设计

> **状态**：Draft v1.1（已应用 Codex 审查反馈 F1~F6）
> **日期**：2026-05-03
> **作者**：jiayin（with Claude Code）
> **范围**：把现有 1150 行单文件 HTML（`scale-system.html`）演进成 monorepo 三应用架构（Web + Desktop + API），引入中心 PostgreSQL，覆盖采集、管理、查询、E2E 测试全链路。

---

## 1 · 背景与目标

### 1.1 业务上下文
水文泥沙采样实验室的称重工作流：

- 选定**项目**（如"S徐六泾断面定线比测202603"）+ **垂线号**（如 V-01）+ **杯号**
- 在 6 个标准化水深点位（0.0 / 0.2 / 0.4 / 0.6 / 0.8 / 1.0）各取一杯水样
- 经烘干后用电子天平称**杯沙重**（湿重），减去**杯重**得**泥沙重**
- 除以采样**容积**得**含沙量**（mg/L）
- 一次完整采样 = 一行宽表数据，含 18 个点位字段（6 含沙量 + 6 杯号 + 6 杯沙重）

### 1.2 目标
1. 现有 HTML 视觉风格 100% 保留（深/浅双主题、SCADA/科研双气质）
2. 拆成前后端分离 + 桌面端三 app monorepo，各自独立 CLAUDE.md 规范
3. 中心 PostgreSQL 存所有数据，Web 与桌面端共享同一数据源
4. 桌面端实现真实串口通信（替代当前 mock LCD），Web 端用 Web Serial API
5. 完整 E2E 覆盖核心动线
6. Docker Compose 一键本地起

### 1.3 非目标
- 不接公司 SSO（用本地 JWT 简单登录）
- 不做多租户
- 不接老 LIMS 系统
- 不做移动端

---

## 2 · 项目顶层结构

```
scale-system/                          ← git 根仓库
├── apps/
│   ├── web/                           ← React 19 + Vite (Web 端 + Tauri 复用)
│   │   ├── CLAUDE.md                  ← 前端规范
│   │   └── src/...
│   ├── api/                           ← FastAPI + SQLAlchemy
│   │   ├── CLAUDE.md                  ← 后端规范
│   │   └── src/scale_api/...
│   └── desktop/                       ← Tauri 壳（src-tauri Rust）
│       ├── CLAUDE.md                  ← 桌面端规范
│       └── src-tauri/...
├── packages/
│   └── shared-types/                  ← OpenAPI 自动生成的 TS 类型
├── docker/
│   ├── docker-compose.yml             ← pg + api + web
│   ├── Dockerfile.api
│   └── Dockerfile.web
├── docs/
│   ├── superpowers/specs/             ← 设计文档存放
│   └── api/                           ← OpenAPI 自动生成
├── scripts/
│   ├── seed-from-excel.py             ← 把现有 Excel 导入为 mock
│   └── ...
├── .github/workflows/                 ← CI（lint/test/build）
├── pnpm-workspace.yaml                ← pnpm monorepo
├── package.json
└── CLAUDE.md                          ← 根级总规范
```

**包管理器**
- 前端 / monorepo：`pnpm`（速度最快、磁盘最省）
- 后端：`uv` + `pyproject.toml`
- 桌面端：`cargo`（Rust）

---

## 3 · 技术栈一览

| 层 | 技术 | 版本 |
|---|---|---|
| **前端框架** | React | 19 |
| **构建** | Vite | 6.x |
| **UI 组件库** | shadcn/ui（Radix UI 底层） | 最新 |
| **样式** | Tailwind CSS | v4 |
| **路由** | React Router | v7 |
| **服务端态** | TanStack Query | v5 |
| **客户端态** | Zustand | v5 |
| **表单** | React Hook Form + Zod | 最新 |
| **HTTP 客户端** | Axios（含拦截器） | 最新 |
| **测试 - 单元** | Vitest + @testing-library/react | 最新 |
| **测试 - E2E** | Playwright（ECC MCP 驱动） | 最新 |
| **桌面端壳** | Tauri | 2.x |
| **桌面端串口** | tokio-serial / serialport-rs | 最新 |
| **桌面端本地队列** | rusqlite | 最新 |
| **后端框架** | FastAPI | 0.115+ |
| **后端 ORM** | SQLAlchemy 2.0（异步） | 最新 |
| **后端迁移** | Alembic | 最新 |
| **后端验证** | Pydantic | v2 |
| **后端任务** | APScheduler / arq | 最新 |
| **后端测试** | pytest + httpx + testcontainers | 最新 |
| **数据库** | PostgreSQL | 16+ |
| **部署** | Docker Compose | — |

---

## 4 · 前端架构（apps/web）

### 4.1 文件组织（Feature-based + 分层）

```
apps/web/src/
├── app/                              ← 路由层（最薄）
│   ├── routes/
│   │   ├── _public/login.tsx
│   │   ├── _auth/                    ← 登录后才能访问
│   │   │   ├── weighing.tsx          ← 主采集页（现 HTML 复刻）
│   │   │   ├── scales/index.tsx      ← 天平 CRUD
│   │   │   ├── scales/[id].tsx
│   │   │   ├── projects/index.tsx
│   │   │   ├── cups/index.tsx
│   │   │   ├── records/index.tsx
│   │   │   └── settings.tsx
│   │   ├── __root.tsx
│   │   └── _auth.tsx                 ← 鉴权 layout
│   └── router.tsx
├── features/                         ← 业务特性（每个特性自包含）
│   ├── auth/                         ← api / hooks / store / components
│   ├── weighing/                     ← BalanceStage / PointGrid / VerticalLineViz / ConfigPanel / state machine
│   ├── scales/                       ← ScaleList / ScaleForm / ConnectionTest
│   ├── projects/                     ← ProjectCombobox（虚拟滚动 + infinite）
│   ├── cups/
│   └── records/                      ← RecordsTable（cursor 分页 + 实时联动）
├── components/                       ← 跨特性的通用 UI
│   ├── ui/                           ← shadcn primitives（按需 add）
│   ├── domain/                       ← LCDDigits / ThemeToggle / StatusChip / LedDot
│   └── layout/                       ← AppShell / Header / NavMenu
├── lib/                              ← 框架/工具层
│   ├── api/                          ← client / error / query-client
│   ├── auth.ts
│   ├── platform.ts                   ← isTauri() 判断 + getSerialAdapter() 工厂
│   ├── serial/                       ← 详见 §4.4 SerialAdapter 接口
│   │   ├── adapter.ts                ← SerialAdapter 接口定义 + 错误码枚举
│   │   ├── browser-serial.ts         ← Web Serial API 实现 implements SerialAdapter
│   │   ├── tauri-serial.ts           ← Tauri invoke 实现 implements SerialAdapter
│   │   ├── parser.ts                 ← 通用 ASCII 重量解析（双端共享）
│   │   └── mock-serial.ts            ← 测试 mock 实现
│   ├── queue/                        ← 客户端持久化队列抽象（详见 §9.6）
│   │   ├── submission-queue.ts       ← SubmissionQueue 接口
│   │   ├── indexeddb-queue.ts        ← Web 实现
│   │   └── tauri-queue.ts            ← 桌面实现（走 invoke 调 rusqlite）
│   ├── format.ts
│   └── utils.ts                      ← cn() 等
├── hooks/                            ← 跨特性通用 hook（useTheme / useReducedMotion / useDebouncedValue）
├── stores/                           ← 跨特性 Zustand store（theme / scale-stream）
├── styles/
│   ├── globals.css                   ← Tailwind + 主题 CSS 变量
│   └── tokens.css                    ← 完整迁移现 HTML 的 token
├── types/
│   └── api.ts                        ← 自动从 packages/shared-types re-export
├── main.tsx
└── App.tsx
```

### 4.2 关键规则
- **一个 feature 内禁止跨 feature 导入**（除 `lib/`、`components/`、`hooks/`、`stores/`）
- 一个文件 ≤ **500 行**（ESLint `max-lines: 500` 强制）
- 服务端态全部走 **TanStack Query**；不要把 API 数据塞 Zustand
- 客户端态（主题、UI 偏好、auth token、串口流）走 **Zustand**
- 主题继续保留深/浅双主题，CSS 变量从现 HTML 100% 迁移到 Tailwind config
- 不允许引入 React 组件库以外的 UI 框架（如 MUI、Antd）

### 4.3 复杂模块预拆分（保证 500 行约束可达）

下列模块是经验上最容易超长的"重灾区"，从架构期就拆好分工：

#### 4.3.1 `features/weighing/components/BalanceStage.tsx`（采集页主图）
现 HTML 这一区单独占了 ~250 行，加上交互、状态机绑定、可访问性后会爆。**拆为 5 个文件**：
- `BalanceStage.tsx`（容器，<150 行）
- `BalanceImage.tsx`（图片 + LCD mask 定位）
- `LCDDisplay.tsx`（数字 + 稳定灯 + 单位）
- `ConnectionStatusBadge.tsx`（顶部状态徽章 + 颜色映射）
- `SamplesHealthIndicator.tsx`（右下角健康度小字）

#### 4.3.2 `features/weighing/machine.ts`（采集状态机）
状态机会膨胀到 7 态 + 多个事件类型。**拆为**：
- `machine.ts`（XState 或纯 reducer 主入口，<200 行）
- `machine.events.ts`（事件类型定义）
- `machine.guards.ts`（守卫函数：`isStable`、`hasConfig` 等）

#### 4.3.3 `lib/serial/`
按 §4.4 接口拆，每文件单一职责，单文件天然 < 300 行。

#### 4.3.4 `features/scales/components/ScaleForm.tsx`
表单字段 ≥ 12 个，加上校验 + 测试连接 dialog 极易超长。**拆为**：
- `ScaleForm.tsx`（容器 + 提交逻辑）
- `ScaleFormFields.tsx`（字段编排）
- `ScaleProtocolFields.tsx`（按 protocol_type 显隐的子字段）
- `ScaleProbeDialog.tsx`（连接探测 dialog，独立组件）

#### 4.3.5 `features/records/components/RecordsTable.tsx`
表格 + 列定义 + 筛选 + 分页 + 行操作合一会爆。**拆为**：
- `RecordsTable.tsx`（容器，绑 `useInfiniteQuery`）
- `RecordsTableColumns.tsx`（列 schema，TanStack Table 风格）
- `RecordsTableFilters.tsx`（顶部过滤条）
- `RecordsTableRowActions.tsx`（行级菜单：编辑/删除/导出）



### 4.4 SerialAdapter 接口契约（双端"业务无感"切换的关键）

业务代码**只**依赖此接口，永远不直接 import `browser-serial` / `tauri-serial`。`platform.ts` 在启动时按环境注入实现。

```ts
// lib/serial/adapter.ts
export type SerialErrorCode =
  | 'PERMISSION_DENIED'      // 用户未授权（Web）/ OS 拒绝（桌面）
  | 'PORT_NOT_FOUND'
  | 'PORT_BUSY'              // 已被其他进程占用
  | 'OPEN_FAILED'
  | 'TIMEOUT'                // 超过 timeout 没数据
  | 'PARSE_ERROR'
  | 'IO_ERROR'
  | 'CLOSED_BY_DEVICE'       // 设备主动断开
  | 'CANCELLED'              // 用户主动取消
  | 'UNSUPPORTED'            // Web 上浏览器不支持 Web Serial API
  | 'UNKNOWN';

export interface SerialPortInfo {
  id: string;                // 平台无关 ID（Web: usbProductId+vendorId; 桌面: '/dev/ttyUSB0' or 'COM3'）
  label: string;             // 给用户看的字符串
  vendor?: string;
  product?: string;
}

export interface ScaleConfig {
  baudRate: number;
  dataBits: 7 | 8;
  parity: 'none' | 'even' | 'odd';
  stopBits: 1 | 2;
  flowControl: 'none' | 'hardware';
  protocolType: 'generic' | 'mettler' | 'sartorius' | 'ohaus';
  readTimeoutMs: number;
  decimalPlaces: number;
  unitDefault: 'g' | 'mg' | 'kg';
}

export interface WeightSample {
  value: number;
  unit: 'g' | 'mg' | 'kg';
  stable: boolean;
  raw: string;        // 原始报文，用于调试
  ts: number;         // ms epoch
}

export type ConnectionState =
  | 'idle' | 'opening' | 'connected' | 'reading'
  | 'error' | 'disconnected';

export interface SerialAdapter {
  /** 列出当前平台可见的串口；Web 上首次会触发权限弹窗 */
  listPorts(): Promise<SerialPortInfo[]>;

  /** 打开端口并应用 config；成功后会触发 onStatus('connected' → 'reading') */
  open(portId: string, config: ScaleConfig): Promise<void>;

  /** 主动关闭并释放端口 */
  close(): Promise<void>;

  /** 实时重量样本订阅；返回退订函数 */
  onWeight(handler: (s: WeightSample) => void): () => void;

  /** 状态变化订阅；返回退订函数 */
  onStatus(handler: (s: ConnectionState) => void): () => void;

  /** 错误事件订阅（含错误码 + 描述） */
  onError(handler: (e: { code: SerialErrorCode; message: string }) => void): () => void;

  /**
   * 一次性"探测连接"：打开 → 读 timeoutMs → 关 → 返回采集结果。
   * 用于 Scale CRUD 中的"测试连接"按钮，不影响外部 onWeight 订阅。
   */
  probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<{
    ok: boolean;
    samples: WeightSample[];
    error?: { code: SerialErrorCode; message: string };
  }>;

  /** 当前平台是否支持串口（Firefox/Safari Web 端会返回 false） */
  isSupported(): boolean;
}
```

**工厂用法**：
```ts
// lib/platform.ts
export function getSerialAdapter(): SerialAdapter {
  if (isTauri()) return new TauriSerialAdapter();
  if ('serial' in navigator) return new BrowserSerialAdapter();
  return new UnsupportedSerialAdapter();   // 始终返回 UNSUPPORTED 错误
}
```

业务层（`features/weighing/hooks.ts`）只引 `useSerialAdapter()`：
```ts
const adapter = useSerialAdapter();
useEffect(() => {
  const offW = adapter.onWeight(setWeight);
  const offS = adapter.onStatus(setStatus);
  return () => { offW(); offS(); };
}, [adapter]);
```

### 4.5 状态管理对照表

| 数据 | 存放 | 持久化 |
|---|---|---|
| Auth user info | Zustand `auth-store` | 不持久化（refresh 后从 `/auth/me` 拉取） |
| Access token | Zustand `auth-store` | **仅内存**，关 tab/重启即丢，靠 refresh 续命 |
| Refresh token | 不进 Zustand | Web：httpOnly cookie；桌面：Tauri stronghold（详见 §11.2） |
| 主题（深/浅） | Zustand `theme-store` | `localStorage` |
| 串口连接状态 + 实时重量 | Zustand `scale-stream-store` | 不持久化 |
| 项目 / 垂线 / 杯 / 记录列表 | TanStack Query | 内存缓存 |
| 表单临时态 | React Hook Form | 不持久化 |
| URL 筛选条件 | URL search params | URL |

---

## 5 · 桌面端架构（apps/desktop）

### 5.1 文件组织

```
apps/desktop/src-tauri/
├── src/
│   ├── main.rs                       ← 启动入口
│   ├── commands/                     ← 暴露给前端的 Tauri command
│   │   ├── mod.rs
│   │   ├── serial.rs                 ← list_ports / open / close / test
│   │   ├── queue.rs                  ← 离线队列 push/pop
│   │   └── system.rs                 ← 系统信息
│   ├── serial/
│   │   ├── mod.rs
│   │   ├── connection.rs             ← SerialConnection 封装
│   │   ├── protocol/                 ← 协议解析器（插件化）
│   │   │   ├── mod.rs
│   │   │   ├── generic.rs            ← 通用 ASCII（默认）
│   │   │   ├── mettler.rs            ← MT-SICS（预留）
│   │   │   └── parser.rs             ← 重量/单位/稳定标志正则
│   │   └── stream.rs                 ← 异步流，emit 给前端
│   ├── queue/
│   │   ├── mod.rs
│   │   ├── db.rs                     ← rusqlite 本地库
│   │   ├── worker.rs                 ← 后台 worker（异步 push）
│   │   └── schema.sql
│   └── config.rs                     ← 本地配置（auth token、API 端点）
├── tauri.conf.json
├── Cargo.toml
└── icons/
```

### 5.2 数据流
1. 前端选了一个"天平配置"（来自后端 DB） → 选本地 COM 口
2. 调用 `invoke('open_serial', { config, port })` → Rust 端打开串口
3. Rust 异步循环读串口 → 解析重量 → `emit('scale-weight', payload)`
4. 前端 `listen('scale-weight')` → 更新 LCD
5. 用户点击"录入" → 优先 POST 后端 → 失败则写 rusqlite 队列 → 后台 worker 重试

### 5.3 状态事件（Tauri emit）
```rust
emit("scale-status", ScaleStatus { state: "connected" });
emit("scale-weight", Weight { value: 45.1234, unit: "g", stable: true, ts });
emit("scale-error",  ScaleError { code: "TIMEOUT", message: "..." });
```

### 5.4 关键规则
- 不在 Rust 端实现业务逻辑，只做平台桥接（串口、本地队列）
- 所有 Tauri command 必须有 `#[tauri::command]` + 参数校验
- 前端通过 `lib/platform.ts` 检测环境，**不**在业务代码里写 `if (isTauri)`
- Rust 文件 ≤ 500 行
- 离线队列 schema 改动必须配迁移脚本

---

## 6 · 后端架构（apps/api）

### 6.1 4 层架构

```
apps/api/src/scale_api/
├── api/                              ← 表现层（FastAPI 路由）
│   ├── v1/
│   │   ├── auth.py                   ← /auth/login /auth/refresh
│   │   ├── scales.py                 ← /scales CRUD + /test
│   │   ├── projects.py               ← /projects CRUD（cursor 分页）
│   │   ├── verticals.py              ← /verticals CRUD（按项目）
│   │   ├── cups.py                   ← /cups CRUD + 率定历史
│   │   ├── records.py                ← /records 实时联动 + 批量同步
│   │   └── users.py                  ← 管理员管理
│   └── deps.py                       ← get_db / get_current_user / require_admin
├── core/
│   ├── config.py                     ← Settings (pydantic-settings)
│   ├── security.py                   ← JWT, bcrypt
│   ├── logging.py
│   └── exceptions.py                 ← 业务异常 → HTTP 响应映射
├── schemas/                          ← Pydantic DTO
│   ├── scale.py / project.py / record.py / cup.py / user.py
│   └── common.py                     ← CursorPage / OffsetPage / ErrorResp
├── services/                         ← 业务层
│   ├── auth_service.py
│   ├── scale_service.py
│   ├── record_service.py             ← 含含沙量计算
│   ├── cup_service.py                ← 率定历史
│   ├── sync_service.py               ← 批量幂等同步
│   └── pagination.py                 ← cursor_paginate / offset_paginate
├── repositories/
│   ├── base.py                       ← BaseRepository[T]
│   ├── scale_repo.py / project_repo.py / record_repo.py / cup_repo.py / user_repo.py
├── models/                           ← SQLAlchemy 模型
│   ├── base.py                       ← Base, TimestampMixin
│   ├── user.py / scale.py / project.py / vertical.py / cup.py
│   ├── cup_calibration.py
│   ├── record.py
│   └── audit_log.py
├── db/
│   ├── session.py                    ← AsyncEngine, async_sessionmaker
│   └── init_db.py                    ← 初始化数据
├── workers/
│   └── sync_worker.py
└── main.py                           ← FastAPI 入口
```

### 6.2 依赖方向（强制）

```
api  ──▶  services  ──▶  repositories  ──▶  models
 │            │
 └─▶ schemas  └─▶ schemas（DTO 跨层）
```

- **api 层**：只做 HTTP 入参出参、调用 service、转 schema
- **service 层**：业务逻辑，**不**直接 import `models`，只通过 repository
- **repository 层**：唯一可以写 SQLAlchemy query 的地方
- **schemas / models 严格分离**：schema 是 API 契约，model 是 DB 结构

### 6.3 关键规则
- Service 不得 import `models`，只通过 repository
- 所有 API 入参出参用 Pydantic schema，不直接返回 ORM 对象
- 数据库写操作必须在事务里，且要写 audit_logs
- 异常用 `core/exceptions.py` 中定义的业务异常类，禁止裸 raise HTTPException
- 文件 ≤ 500 行
- 测试覆盖率 80%

### 6.4 复杂后端模块预拆分（保证 500 行约束可达）

#### 6.4.1 `api/v1/records.py`
6 个端点（list / get / create / batch / put / delete / export）+ 各自请求体校验 + 错误映射会超长。**拆为**：
- `records.py`（路由聚合，仅 router 注册）
- `records_query.py`（GET list、GET by id、export）
- `records_mutation.py`（POST、PUT、DELETE）
- `records_batch.py`（POST /batch 幂等同步）

#### 6.4.2 `services/record_service.py`
含含沙量计算、点位校验、批量幂等去重、审计写入。**拆为**：
- `record_service.py`（公开方法门面，<200 行）
- `record_validator.py`（points 数组结构与一致性校验）
- `record_calculator.py`（含沙量公式、平均值、单位换算）
- `record_batch_processor.py`（批量同步去重 + 返回结构）

#### 6.4.3 `api/v1/scales.py`
CRUD + validate + admin 权限分支。**拆为**：
- `scales.py`（CRUD 路由）
- `scales_admin.py`（仅管理员的批量操作）

#### 6.4.4 `services/sync_service.py`
即 `record_batch_processor.py` 的协调者，独立文件。

#### 6.4.5 `repositories/record_repo.py`
查询逻辑（cursor 分页 + JSONB 表达式查询 + 多过滤）会超长。**拆为**：
- `record_repo.py`（基础 CRUD）
- `record_query_builder.py`（动态 WHERE 拼装、按 cup_number 反查、JSONB 路径查询）



---

## 7 · 数据库 Schema（PostgreSQL）

### 7.1 用户与权限
```sql
users (
  id           BIGSERIAL PRIMARY KEY,
  username     VARCHAR(64)  UNIQUE NOT NULL,
  email        VARCHAR(128) UNIQUE,
  password_hash TEXT NOT NULL,
  role         VARCHAR(16) NOT NULL CHECK (role IN ('operator','admin')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)

refresh_tokens (
  id           BIGSERIAL PRIMARY KEY,
  jti          UUID UNIQUE NOT NULL,                  -- JWT ID（refresh 唯一标识）
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,                         -- 仅存哈希（不存原 token）
  client_kind  VARCHAR(8) NOT NULL,                   -- 'web' | 'desktop'
  user_agent   TEXT,
  ip_address   INET,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,                           -- 主动注销/检测到泄露时填
  rotated_to   UUID                                   -- 配套轮换链路追踪
)
CREATE INDEX rtok_user_active_idx ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX rtok_expires_idx     ON refresh_tokens(expires_at);
```
- 仅存 `token_hash`（SHA-256），泄露日志不暴露原 token
- 每次 `/auth/refresh` 强制轮换：旧记录 `revoked_at = now()`、`rotated_to = 新 jti`，发新 token
- 检测到 reuse（已 revoked 的 token 又被用） → 立即吊销该用户所有 refresh，强制重登
- 后台 cron 每天清理 `expires_at < now() - 30 days` 的记录

### 7.2 项目库
```sql
projects (
  id               BIGSERIAL PRIMARY KEY,
  name             VARCHAR(128) UNIQUE NOT NULL,
  established_date DATE,
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       BIGINT REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX projects_created_at_desc_idx ON projects(created_at DESC);
CREATE INDEX projects_active_created_idx  ON projects(is_active, created_at DESC);
```
- `updated_at` 由 SQLAlchemy `onupdate=func.now()` 维护
- 项目下拉默认按 `created_at DESC` 取前 20

### 7.3 垂线
```sql
verticals (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code        VARCHAR(32) NOT NULL,
  label       VARCHAR(128),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
)
CREATE INDEX verticals_proj_sort_idx ON verticals(project_id, sort_order);
```

### 7.4 天平
```sql
scales (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(64) NOT NULL,
  model           VARCHAR(64),
  protocol_type   VARCHAR(32) NOT NULL DEFAULT 'generic',  -- 'generic'|'mettler'|'sartorius'|'ohaus'
  baud_rate       INT  NOT NULL DEFAULT 9600,
  data_bits       SMALLINT NOT NULL DEFAULT 8,
  parity          VARCHAR(8) NOT NULL DEFAULT 'none',     -- none|even|odd
  stop_bits       SMALLINT NOT NULL DEFAULT 1,
  flow_control    VARCHAR(8) NOT NULL DEFAULT 'none',     -- none|hardware|software
  read_timeout_ms INT NOT NULL DEFAULT 1000,
  decimal_places  SMALLINT NOT NULL DEFAULT 4,
  unit_default    VARCHAR(8) NOT NULL DEFAULT 'g',
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### 7.5 杯库与率定历史
```sql
cups (
  id                       BIGSERIAL PRIMARY KEY,
  cup_number               VARCHAR(32) UNIQUE NOT NULL,
  current_tare_g           NUMERIC(10,4) NOT NULL,
  latest_calibration_date  DATE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX cups_number_trgm_idx ON cups USING gin (cup_number gin_trgm_ops);

cup_calibrations (
  id              BIGSERIAL PRIMARY KEY,
  cup_id          BIGINT NOT NULL REFERENCES cups(id) ON DELETE CASCADE,
  tare_g          NUMERIC(10,4) NOT NULL,
  calibrated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibrated_by   BIGINT REFERENCES users(id),
  method          VARCHAR(32),
  notes           TEXT
)
CREATE INDEX cup_cal_cup_time_idx ON cup_calibrations(cup_id, calibrated_at DESC);
```

### 7.6 称重记录（核心）

**points JSONB 字段标准结构**（由 service 层写入前严格校验）：
```jsonc
[
  {
    "pos": "0.0",                  // 字符串以避免浮点比较问题，枚举：0.0/0.2/0.4/0.6/0.8/1.0
    "cup_id": 1234,                // FK 到 cups.id
    "cup_number": "C-1024",        // 冗余，便于查询/导出，service 写入时与 cup_id 一致性校验
    "cup_tare_g": 35.2480,         // 快照（杯重当时值，避免后续率定影响历史）
    "wet_weight_g": 168.4521,      // 杯沙重
    "concentration_mg_l": 0.3109,  // 含沙量（service 算好写入，不依赖客户端）
    "weighed_at": "2026-05-03T10:23:45+08:00"
  }
]
```

```sql
weighing_records (
  id                         BIGSERIAL PRIMARY KEY,
  client_uid                 UUID UNIQUE NOT NULL,                      -- 客户端幂等键
  project_id                 BIGINT NOT NULL REFERENCES projects(id),
  vertical_id                BIGINT NOT NULL REFERENCES verticals(id),
  tide_type                  VARCHAR(8),                                -- 大潮|小潮|平潮|NULL
  sample_date                DATE NOT NULL,
  water_depth_m              NUMERIC(8,2),
  start_time                 TIMESTAMPTZ,
  end_time                   TIMESTAMPTZ,
  volume_ml                  NUMERIC(10,2),
  points                     JSONB NOT NULL,                            -- 见上方结构
  computed_avg_concentration NUMERIC(12,4),                             -- service 层算好写入
  notes                      TEXT,
  operator_id                BIGINT REFERENCES users(id),
  source                     VARCHAR(8) NOT NULL DEFAULT 'web',         -- 'web'|'desktop'
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- 主查询路径索引
CREATE INDEX rec_proj_vert_date_idx ON weighing_records(project_id, vertical_id, sample_date DESC);
CREATE INDEX rec_created_idx        ON weighing_records(created_at DESC);

-- JSONB 通用结构索引（key 是否存在、值匹配）
CREATE INDEX rec_points_gin_idx     ON weighing_records USING gin (points jsonb_path_ops);

-- 表达式索引（覆盖按 cup_number / cup_id 反查的场景）
-- 思路：把 points 中的 cup_number / cup_id 各自摊平成数组，建 GIN
CREATE INDEX rec_points_cup_numbers_idx ON weighing_records
  USING gin ((
    ARRAY(SELECT jsonb_array_elements(points)->>'cup_number')
  ));
CREATE INDEX rec_points_cup_ids_idx ON weighing_records
  USING gin ((
    ARRAY(SELECT (jsonb_array_elements(points)->>'cup_id')::BIGINT)
  ));
```

**查询样例**（service 层封装，repository 提供）：
```sql
-- 按杯号反查所有记录
SELECT * FROM weighing_records
WHERE ARRAY(SELECT jsonb_array_elements(points)->>'cup_number') @> ARRAY['C-1024'];

-- 按 cup_id 反查
SELECT * FROM weighing_records
WHERE ARRAY(SELECT (jsonb_array_elements(points)->>'cup_id')::BIGINT) @> ARRAY[1234::BIGINT];

-- 按某点位含沙量范围
SELECT * FROM weighing_records
WHERE points @? '$[*] ? (@.pos == "0.6" && @.concentration_mg_l > 0.5)';
```

**幂等性关键**：`client_uid` 是客户端（含桌面/Web 队列）生成的 UUID，后端用它做去重。

### 7.6.1 决策门：是否拆 `record_points` 子表？

**当前选择**：保留 JSONB（不拆子表）。

**重审触发条件**（任一命中需立刻评估拆表）：
1. 按点位维度的查询超过总查询量的 30%
2. 单个 record 的 points 数组长度超过 12（如改为 12 点位采样）
3. PG 上规模 > 100 万行后，上述表达式索引查询的 P95 > 200 ms
4. 业务出现"需要对单个点位独立审计/版本化"的需求

**拆表方案预案**（备查，不是当前实施）：
```sql
record_points (
  id                  BIGSERIAL PRIMARY KEY,
  record_id           BIGINT NOT NULL REFERENCES weighing_records(id) ON DELETE CASCADE,
  pos                 VARCHAR(8) NOT NULL,
  cup_id              BIGINT NOT NULL REFERENCES cups(id),
  cup_number_snapshot VARCHAR(32) NOT NULL,
  cup_tare_g          NUMERIC(10,4) NOT NULL,
  wet_weight_g        NUMERIC(12,4) NOT NULL,
  concentration_mg_l  NUMERIC(14,4) NOT NULL,
  weighed_at          TIMESTAMPTZ,
  UNIQUE (record_id, pos)
)
```
迁移路径：写 Alembic data migration，把 JSONB 摊平成行；保留 JSONB 列做应急回退一段时间后再删。

### 7.7 审计日志
```sql
audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   BIGINT REFERENCES users(id),
  action     VARCHAR(32) NOT NULL,         -- create|update|delete|login|...
  entity     VARCHAR(32) NOT NULL,         -- scale|project|cup|record|...
  entity_id  BIGINT,
  before     JSONB,
  after      JSONB,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX audit_actor_at_idx  ON audit_logs(actor_id, at DESC);
CREATE INDEX audit_entity_idx    ON audit_logs(entity, entity_id, at DESC);
```

---

## 8 · API 表面（REST · `/api/v1`）

### 8.1 通用约定
- **Content-Type**：JSON
- **认证**：`Authorization: Bearer <jwt>`
- **错误结构**：
  ```json
  { "error": { "code": "RECORD_NOT_FOUND", "message": "...", "details": {} } }
  ```
- **分页**：cursor 优先，offset 备选（详见 §10）

### 8.2 端点清单
```
认证
  POST   /auth/login          → {access_token, refresh_token, user}
  POST   /auth/refresh
  POST   /auth/logout
  GET    /auth/me

项目
  GET    /projects            ?q=&is_active=&sort=-created_at&limit=20&cursor=...
  POST   /projects
  GET    /projects/{id}
  PUT    /projects/{id}
  DELETE /projects/{id}       (admin · 软删除)
  GET    /projects/{id}/verticals
  POST   /projects/{id}/verticals
  PUT    /verticals/{id}
  DELETE /verticals/{id}

天平
  GET    /scales              ?q=&is_active=&page=1&size=20
  POST   /scales              (admin)
  GET    /scales/{id}
  PUT    /scales/{id}         (admin)
  DELETE /scales/{id}         (admin · 软删除)
  POST   /scales/{id}/validate → 服务端校验 schema 合法性（参数范围、协议匹配）
  POST   /scales/{id}/probe-result → 客户端实测后回报结果（成功样本/失败原因），用于审计与历史可观察性

杯库
  GET    /cups                ?q=&is_active=&page=1&size=50
  POST   /cups                (admin)
  PUT    /cups/{id}           (admin)
  POST   /cups/{id}/calibrate (记录一次率定，含值与时间)
  GET    /cups/{id}/calibrations

称重记录
  GET    /records             ?project_id=&vertical_id=&date_from=&date_to=&q=&sort=-sample_date&limit=50&cursor=...
  POST   /records             单条录入（含 client_uid）
  POST   /records/batch       客户端离线队列同步（双端共享，幂等，按 client_uid 去重）
  GET    /records/{id}
  PUT    /records/{id}
  DELETE /records/{id}        (admin)
  GET    /records/export      Excel/CSV 流式下载

用户管理（admin）
  GET    /users
  POST   /users
  PUT    /users/{id}
  DELETE /users/{id}
```

---

## 9 · 关键流程

### 9.1 流程 A · 登录
1. FE 提交 username/password → `POST /auth/login`
2. BE 验证 → 同时返回：
   - access token：响应 body（FE 仅放内存）
   - refresh token：
     - Web：`Set-Cookie: __Host-refresh=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh`
     - 桌面（请求头里有 `X-Client: desktop`）：响应 body 返回，FE 写 Tauri stronghold
3. 后续请求 Axios 拦截器加 `Authorization: Bearer <access>`（access token 来自内存 Zustand）
4. 401 → 自动 `POST /auth/refresh`：
   - Web：浏览器自动带 cookie；body 带 CSRF token
   - 桌面：从 stronghold 读 refresh token，放 Authorization 头
5. refresh 也失败 → 清状态 + 跳登录页
6. 应用启动时静默调一次 `/auth/refresh`，成功则免登录恢复会话；失败显示登录页

### 9.2 流程 B · 采集 → 录入（双端语义统一）

**核心原则**：双端都走"客户端幂等队列"模型，区别仅在**持久化介质**（桌面 rusqlite / Web IndexedDB）和**重试上限**。业务代码、错误处理、UI 表现保持一致。

```
1. 选项目/垂线/杯号 → 前端表单
2. 选已配置天平 + 选本地端口 → lib/platform.ts.SerialAdapter（统一接口，详见 §4.1）
3. SerialAdapter 持续 emit weight/status/error 事件
4. 用户点"开始称重" → 进入"采集中"状态机
5. 重量稳定（连续 N 次 ±tolerance 内） → 提示可录入
6. 点"录入" → 客户端组装 record body（含 client_uid UUID） →
   写入"客户端持久化队列"（SubmissionQueue 抽象）：
     · 桌面：rusqlite `pending_records` 表
     · Web：IndexedDB `pending_records` object store
7. 后台 SyncWorker（每 30s + 网络恢复事件 + 用户手动）批量 POST `/records/batch`
8. 成功 → 队列删除 + invalidateQueries(['records', filters]) → 左表刷新
9. 失败 → attempt_count++，<5 进入下一轮重试；≥5 标记 'needs_review'，UI 弹横幅提醒
```

**双端唯一差异**：
| 维度 | 桌面（Tauri） | Web 浏览器 |
|---|---|---|
| 队列介质 | rusqlite（崩溃/断电也保留） | IndexedDB（关 tab 后保留，清缓存丢失） |
| 重试上限 | 无上限（操作员看到才处理） | 5 次后 `needs_review` 横幅 |
| 网络断开提示 | 系统级 toast + tray 图标 | 浏览器内 toast |
| 后台运行 | 始终在（OS 服务级） | 仅 tab 打开时 |

**Web 端的折中**：tab 关闭后 worker 停止；下次打开自动恢复重试。提交即关 tab 的极端场景（罕见）会留 `pending` 记录到下次访问。这是 Web 平台天然限制，文档化即可。

### 9.3 流程 C · 项目+垂线联动 → 左表实时
1. URL search params 同步 `?project_id=...&vertical_id=...`
2. TanStack Query `queryKey: ['records', { project_id, vertical_id, ... }]`
3. 配置项变更 → queryKey 变 → 自动 refetch
4. **多用户实时性策略**：`refetchInterval: 10_000`（10s 轮询）+ 录入成功后立即 `invalidateQueries`
5. 不用 WebSocket/SSE：实验室场景 10s 延迟足够，连接管理成本不划算

### 9.4 流程 D · 项目下拉"查看更多"
1. 项目 Combobox 默认 `useInfiniteQuery({ pageSize: 20, sort: '-created_at' })`
2. 输入时 debounce 300ms 重新搜索（`q=` 参数）
3. 滚到底自动加载下一页
4. "+ 新建项目"按钮直接弹 dialog（管理员可见）

### 9.5 流程 E · 天平连接探测（CRUD 中）
**两步语义分离**（对应 §8.2 的 `/validate` 与 `/probe-result`）：

1. **保存前服务端校验**：表单提交前先调 `POST /scales/{id}/validate`（PUT 也内置），服务端按 protocol_type 检查 baud/parity/data_bits 组合是否合法（如 mettler 不支持 2 stop bits）
2. **保存后客户端实测**：在 `/scales/{id}` 编辑页点"探测连接"按钮 → 弹 dialog 选本地端口 → 调用 `SerialAdapter.probe(portId, config, 3000)` → 收到结果后**自动回报** `POST /scales/{id}/probe-result`（含 ok / 样本数 / 错误码），后端写 audit_logs

为什么拆两步：
- 服务端无法接触实际硬件，只能做配置合法性 schema 校验
- 客户端"探测"是物理动作，结果对配置正确性是决定性证据
- 回报到后端后，管理员能在审计页看到"哪台机器、什么时候、对哪个天平、探测成功/失败"

### 9.6 流程 F · 异步同步（双端共享，介质不同）
- 队列 schema：`pending_records(client_uid UUID PK, payload JSON, status, attempt_count, last_error, created_at, updated_at)`
- 介质：桌面用 rusqlite；Web 用 IndexedDB
- 抽象层 `lib/queue/submission-queue.ts` 提供 `enqueue / drain / markFailed / markSynced` 统一 API
- worker 触发条件：每 30 s / 网络恢复事件 / 用户手动触发 / 应用启动时
- 批量 POST `/records/batch` ≤ 100 条/批
- 后端按 `client_uid` 去重（`ON CONFLICT (client_uid) DO NOTHING RETURNING id`）
- 成功 → 状态改 `synced` 后异步删除；失败 `attempt_count++`
- Web 端 5 次后 `needs_review`；桌面端继续重试但 UI 提醒
- **幂等保证**：`/records/batch` 返回每条的 `{client_uid, status: 'created'|'duplicate'|'invalid'}`，客户端按状态处理

### 9.7 流程 G · 天平连接状态机
```
idle ──open()──▶ opening ──ok──▶ connected ──first sample──▶ reading
                    │                  │                        │
                    │                  └──no data 5s──▶ error   └──close()──▶ disconnected
                    └──fail──▶ error                                          │
                                                                              └──open()──▶ opening
```
- store：`stores/scale-stream-store.ts` 持有 connection / lastWeight / error / samplesPerSec
- UI：`BalanceStage.tsx` 顶部 StatusChip 颜色随状态变（idle 灰 / opening 黄 / reading 绿闪 / error 红）
- 健康度：`samplesPerSec` 右下角小字（>3/s 正常，<1/s 警告）

---

## 10 · 分页策略

| 类型 | 用途 | 入参 | 出参 |
|---|---|---|---|
| **cursor**（默认） | 实时联动列表（左表 records）、项目下拉 infinite scroll | `?cursor=opaque&limit=N` | `{ items, next_cursor }` |
| **offset**（备选） | 数据浏览页（管理员浏览历史） | `?page=N&size=M` | `{ items, total, page, size }` |

后端 `services/pagination.py` 提供：
```python
async def cursor_paginate(query, key, limit, cursor) -> CursorPage[T]
async def offset_paginate(query, page, size) -> OffsetPage[T]
```

`schemas/common.py` 导出 `CursorPage[T]` / `OffsetPage[T]`，前端 TS 类型同步生成。

---

## 11 · 鉴权与安全

### 11.1 密码与 token
- **密码**：bcrypt（cost=12）
- **JWT 算法**：HS256（开发）/ RS256（生产，密钥从环境变量加载）
- **Access token**：30 min，**仅放在内存**（Zustand），不写持久化存储
- **Refresh token**：7 d，存 PG `refresh_tokens` 表（仅哈希）+ 客户端持久化（详见 11.2）
- **轮换**：每次 `/auth/refresh` 强制轮换 + reuse 检测（见 §7.1）

### 11.2 客户端 token 存储策略（按客户端区分，避免 XSS 窃取）

| 客户端 | access token | refresh token |
|---|---|---|
| **Web** | 内存（Zustand）+ 关闭 tab 即丢 | **httpOnly + Secure + SameSite=Strict cookie**，路径限 `/api/v1/auth/refresh`，前端 JS 不可读 |
| **Desktop（Tauri）** | 内存 | **Tauri stronghold / OS keychain**（macOS Keychain / Windows DPAPI / Linux libsecret），不写文件系统明文 |

- **明确禁止**把 refresh token 放 `localStorage` / `sessionStorage`（XSS 易被窃）
- **明确禁止**把 access token 放 cookie（CSRF 攻击面）
- 由于 refresh 走 cookie，`/auth/refresh` 端点必须做 CSRF 双重验证：
  - 请求体里带一个 `X-CSRF-Token`，与 cookie 里的 csrf token 比对（同站策略外加防御）
  - 仅接受 `POST` 请求
- 桌面端不走 cookie，直接发 `Authorization: Bearer <refresh>`（局域网受信环境）

### 11.3 网络与传输
- **CORS**：FastAPI 严格白名单（开发 `http://localhost:5173`，生产填实际域名）+ `allow_credentials=True`（cookie 需要）
- **HTTPS**：生产用 Caddy 自动 cert；本地开发可放任，但 cookie 标 `Secure` 需要 `__Host-` prefix 仅在 HTTPS 启用
- **HSTS**：生产开启 `max-age=63072000; includeSubDomains; preload`

### 11.4 其他
- **Rate limit**：登录端点 5/min/IP（slowapi）；refresh 端点 30/min/IP
- **审计**：所有 admin 操作（删除、修改主数据） + 所有登录/登出/refresh reuse 事件 都写 `audit_logs`
- **XSS 防护**：禁止 `dangerouslySetInnerHTML`；所有用户输入用 React 默认转义；CSP 头：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- **依赖审计**：CI 跑 `pnpm audit` + `pip-audit`

---

## 12 · 测试策略

### 12.1 工具矩阵

| 层 | 工具 | 覆盖目标 |
|---|---|---|
| FE 单元 | Vitest + RTL | hooks、纯函数、工具 |
| FE 组件 | Vitest + RTL + msw | 组件交互、API mock |
| FE E2E | **Playwright（ECC MCP 驱动）** | 登录、采集、录入、CRUD 全流程，深浅主题各跑一遍 |
| BE 单元 | pytest | service / repository 纯逻辑 |
| BE 集成 | pytest + httpx + testcontainers-pg | API 端到端 + 真 PG |
| BE 迁移 | pytest-alembic | 升降级测试 |

**覆盖率目标 80%**（前后端单独算）。

### 12.2 E2E 用例清单

| ID | 动线 | 关键断言 |
|---|---|---|
| E2E-01 | 登录 → 进采集页 | URL、user 卡片、权限按钮可见性 |
| E2E-02 | 切换主题（深↔浅） | CSS 变量、主题持久化 |
| E2E-03 | 选项目 → 选垂线 → 左表自动刷新 | 表格行数变、loading 闪一下、URL query 同步 |
| E2E-04 | 项目下拉"查看更多" | infinite scroll、搜索 debounce |
| E2E-05 | 配置天平 → 点"测试连接"（mock） | dialog 显示采样数据、关闭释放端口 |
| E2E-06 | 模拟天平流入 → LCD 实时更新 | 5s 内至少 15 个 `samplesPerSec` |
| E2E-07 | 完整称重流程：稳定→录入→左表+1 | 表格立刻多一行、`liveWeight` 重置 |
| E2E-08 | 天平 CRUD：增→改→连测→删 | 表格内容、toast、权限 |
| E2E-09 | 项目 CRUD + 杯库 CRUD | 同上 |
| E2E-10 | 数据浏览页：分页+筛选+导出 Excel | 文件下载、内容头校验 |
| E2E-11 | 断网重连：录入失败提示 + 队列（仅桌面） | toast、本地队列长度 |
| E2E-12 | 鉴权失败：401 自动 refresh / 强制登出 | 拦截器行为 |

### 12.3 串口数据 mock
- `apps/web/tests/e2e/mock-server.ts` 在 Vite middleware 里启动一个 mock 串口流
- Playwright 启动前 fixture 会暴露重量样本生成器到 `window.__mockScale__`
- 业务代码通过 `lib/serial/browser-serial.ts` 读取，自然走到 mock 通道

### 12.4 跑法
```
pnpm --filter web test            ← 单元 + 组件
pnpm --filter web test:e2e        ← Playwright
pnpm --filter api test            ← pytest
pnpm test                         ← 全跑
```
CI：`playwright test --project=chromium-dark --project=chromium-light`，失败截图、视频、trace 全开。

---

## 13 · 部署（Docker Compose 本地）

```yaml
services:
  pg:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: scale
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: scale_system
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ['5432:5432']
    healthcheck: ...
  api:
    build: { context: .., dockerfile: docker/Dockerfile.api }
    depends_on: { pg: { condition: service_healthy } }
    environment:
      DATABASE_URL: postgresql+asyncpg://scale:${PG_PASSWORD}@pg/scale_system
      JWT_SECRET: ${JWT_SECRET}
      ALLOWED_ORIGINS: http://localhost:5173
    ports: ['8000:8000']
  web:
    build: { context: .., dockerfile: docker/Dockerfile.web }
    ports: ['5173:80']     # nginx 静态托管
volumes:
  pgdata:
```

桌面端 Tauri 不进 Docker。开发：`pnpm tauri dev`。发布：`pnpm tauri build` → dmg / msi / AppImage。

---

## 14 · 三个 CLAUDE.md 的内容大纲

### 14.1 `apps/web/CLAUDE.md` 关键约束
- React 19 + Vite + shadcn + Tailwind 锁定
- 文件 ≤ 500 行（ESLint `max-lines: 500`）
- 一个 feature 不跨 feature 导入
- 服务端态用 TanStack Query，禁止把 API 数据放 Zustand
- 主题变量沿用现 HTML 的 token，不引入新色板
- 不允许引入 React 组件库以外的 UI 框架
- 测试覆盖率 80%
- 新增 shadcn 组件：`pnpm dlx shadcn@latest add <name>`
- 不允许 `dangerouslySetInnerHTML`（XSS）

### 14.2 `apps/api/CLAUDE.md` 关键约束
- 4 层依赖严格单向：api → service → repository → models
- Service 不得 import `models`，只通过 repository
- 所有 API 入参出参用 Pydantic schema，不直接返回 ORM
- 数据库写操作必须在事务里 + 写 audit_logs
- 异常用 `core/exceptions.py` 中定义的业务异常类，禁止裸 `raise HTTPException`
- 文件 ≤ 500 行
- 测试覆盖率 80%
- 数据库变更必须先 `alembic revision --autogenerate`，**禁止**手改表结构

### 14.3 `apps/desktop/CLAUDE.md` 关键约束
- 不在 Rust 端实现业务逻辑，只做平台桥接（串口、本地队列）
- 所有 Tauri command 必须有 `#[tauri::command]` + 参数校验
- 前端通过 `lib/platform.ts` 检测环境，不在业务代码里写 `if (isTauri)`
- Rust 文件 ≤ 500 行
- 离线队列 schema 改动必须配迁移脚本
- 不允许在 Rust 端直接调后端 API（让前端去调）

### 14.4 根 `CLAUDE.md`
- 指向各子项目，列出跨子项目的 invariant（命名、提交、PR 流程）
- 指向 `docs/superpowers/specs/` 作为决策文档源
- 强制：所有跨 app 改动必须更新 `packages/shared-types`

---

## 15 · 实施顺序（高层）

```
Phase 0  脚手架       monorepo + 三 app 空跑 + Docker Compose 起空 PG
Phase 1  后端骨架     FastAPI + DB schema + Alembic + auth + users
Phase 2  后端业务     scales / projects / verticals / cups / records CRUD + 分页
Phase 3  前端基建     Vite + Tailwind + shadcn 引入 + AppShell + theme + Router
Phase 4  前端复刻     把现 HTML 的采集页迁移成 React 组件（保视觉）
Phase 5  前端 CRUD    天平 / 项目 / 杯库 / 记录 4 个管理页 + 实时联动
Phase 6  桌面端       Tauri 串口 + 本地队列 + 异步 worker
Phase 7  数据迁移     把现 Excel 导入成 mock 数据（一次性脚本）
Phase 8a Playwright 接入 + mock 串口服务器
Phase 8b E2E-01~04（基础 UI + 主题 + 联动）
Phase 8c E2E-05~07（采集核心动线）
Phase 8d E2E-08~10（CRUD + 浏览导出）
Phase 8e E2E-11~12（异常路径，桌面端独立）
Phase 9  Docker 上线  本地 docker compose 跑通
```

每个 Phase 详细任务、依赖、验收标准在 writing-plans 阶段细化。

---

## 16 · 已决策事项汇总

| 决策 | 选择 |
|---|---|
| 客户端拓扑 | Web + Desktop 双端，共用中心 PG（方案 B） |
| 后端语言 | Python + FastAPI |
| 数据库 | PostgreSQL 16+ |
| 数据范围 | 记录 + 项目 + 垂线 + 杯库（含率定历史） |
| 记录 schema | JSONB 半结构化（points 字段） |
| 现有 Excel | 作为 mock 数据初始化导入 |
| 杯库率定 | 完整历史表（cup_calibrations） |
| 鉴权模型 | 简单登录 + 2 角色（operator/admin） |
| 部署 | Docker Compose（先本地） |
| 串口协议 | 通用 ASCII 优先 + 插件化扩展 |
| 离线策略 | 双端统一"客户端幂等队列 + 后台 SyncWorker"模型，介质不同（rusqlite / IndexedDB） |
| 串口配置 | 中心 DB + 本地 COM 映射 |
| 项目结构 | Monorepo（pnpm workspaces） |
| 前端栈 | React 19 + Vite + shadcn + Tailwind |
| 路由 | React Router v7 |
| 状态 | TanStack Query + Zustand |
| 文件大小 | ≤ 500 行（ESLint 强制） |
| 实时联动 | TanStack Query 轮询 10s + 录入后 invalidate |
| 分页 | cursor（实时） + offset（浏览） |
| E2E | Playwright + ECC MCP，12 条动线 |

---

## 17 · 待澄清 / 后续决定

- 国际化（i18n）：本期不做，全中文
- 移动端响应式：本期不做（仅桌面浏览器 ≥ 1280 宽）
- 数据可视化（如垂线 SVG 图）保留现 HTML 设计，复刻为 React 组件
- 是否做"杯库批量导入 Excel" 的管理员能力：**P2**，先用一次性脚本

---

**END OF DESIGN v1.0**
