# apps/web · 前端规范

> 与 spec `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md` §4 / §9 / §11 / §12 强绑定。

## 技术栈（锁定）

- React 19 + Vite 6 + TypeScript 5.6
- Tailwind CSS v4
- shadcn/ui（Radix UI 底层）
- React Router v7
- TanStack Query v5（服务端态）
- Zustand v5（客户端态）
- React Hook Form + Zod（表单）

## 强制规则

1. **文件 ≤ 500 行**（ESLint `max-lines: 500`，超过拆按 §4.3 的预拆分计划）
2. **一个 feature 内禁止跨 feature 导入**（除 `lib/`、`components/`、`hooks/`、`stores/`）
3. **服务端态用 TanStack Query**，**禁止**把 API 数据塞 Zustand
4. **客户端态**（主题、UI 偏好）走 Zustand
5. **不允许**引入 React 组件库以外的 UI 框架（如 MUI、Antd）
6. **禁止** `dangerouslySetInnerHTML`
7. **API 类型**只 import from `@scale/shared-types`，不手写
8. **串口** 只通过 `lib/serial/adapter.ts` 的 `SerialAdapter` 接口，**禁止**直接调 Web Serial 或 Tauri invoke
9. 测试覆盖率 ≥ 80%（vitest 强制）
10. 主题变量沿用现 `scale-system.html` 的 token，不引入新色板

## 复杂模块拆分（spec §4.3）

新增/修改下列组件时必须按此拆分：
- `BalanceStage.tsx` → BalanceImage / LCDDisplay / ConnectionStatusBadge / SamplesHealthIndicator
- `weighing/machine.ts` → machine.events.ts + machine.guards.ts
- `ScaleForm.tsx` → ScaleFormFields / ScaleProtocolFields / ScaleProbeDialog
- `RecordsTable.tsx` → RecordsTableColumns / RecordsTableFilters / RecordsTableRowActions

## shadcn 组件添加

```bash
pnpm dlx shadcn@latest add button input dialog table form
```

新增的 ui 组件落在 `src/components/ui/`，**不**修改其内部代码（升级时会被覆盖）。

## 常用命令

```bash
pnpm dev               # 开发
pnpm test              # 单元
pnpm test:e2e          # E2E
pnpm lint              # ESLint
pnpm typecheck         # tsc
pnpm build             # 生产构建
```
