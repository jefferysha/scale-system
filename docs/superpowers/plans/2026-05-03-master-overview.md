# 天平称重系统 · 实施总览

> **For agentic workers:** 本文件是总览。每个阶段有独立 plan 文件，详见 §阶段索引。实施时使用 superpowers:subagent-driven-development。

**Spec：** `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md`
**Goal：** 把现有 1150 行 HTML 演进成 monorepo 三 app（web/api/desktop）+ PG，覆盖采集、管理、E2E 全链路
**Tech Stack：** React 19 + Vite + shadcn + Tailwind / FastAPI + SQLAlchemy 2 + PostgreSQL 16 / Tauri 2 + Rust

---

## 阶段索引

| Phase | Plan 文件 | 状态 | 并行度 |
|---|---|---|---|
| 0 | `phase-0-scaffold.md` | 待办（首发） | 无（前置） |
| 1 | `phase-1-backend-skeleton.md` | 待办 | 与 Phase 3 并行 |
| 2 | `phase-2-backend-business.md` | 后续生成 | Phase 2.x 内部可并行 |
| 3 | `phase-3-frontend-infrastructure.md` | 待办 | 与 Phase 1 并行 |
| 4 | `phase-4-frontend-weighing-page.md` | 后续生成 | 依赖 Phase 3 |
| 5 | `phase-5-frontend-crud.md` | 后续生成 | Phase 5.x 内部可并行 |
| 6 | `phase-6-desktop-tauri.md` | 后续生成 | 依赖 Phase 4 |
| 7 | `phase-7-data-migration.md` | 后续生成 | 依赖 Phase 1 |
| 8 | `phase-8-e2e-tests.md` | 后续生成 | 依赖 Phase 5 |
| 9 | `phase-9-docker-compose.md` | 后续生成 | 末期 |

---

## 依赖图

```
Phase 0 (scaffold)
   │
   ├──▶ Phase 1 (BE skeleton: auth + users + db)
   │       │
   │       ├──▶ Phase 2 (BE business: scales/projects/cups/records)
   │       │       │
   │       │       └──▶ Phase 7 (data migration from Excel)
   │       │
   │       └──▶ Phase 5 (FE CRUD pages，需要 BE API)
   │               │
   │               └──▶ Phase 8 (E2E: 12 条动线)
   │
   └──▶ Phase 3 (FE infra: Vite + Tailwind + shadcn + AppShell + Router)
           │
           └──▶ Phase 4 (FE 采集页复刻)
                   │
                   ├──▶ Phase 5 (同上)
                   └──▶ Phase 6 (Tauri 桌面壳)

Phase 9 (Docker) — 末期收尾
```

## 并行执行路线（节点数）

```
T0:  Phase 0          (1 个 agent)
T1:  Phase 1 || Phase 3   (2 个 agent 并行)
T2:  Phase 2 || Phase 4   (2 个 agent 并行；Phase 2 内部 4 个实体可再并行)
T3:  Phase 5 || Phase 6 || Phase 7   (3 个 agent 并行)
T4:  Phase 8          (1 个 agent，多个 spec 文件可并行)
T5:  Phase 9          (1 个 agent)
```

---

## 跨阶段不变量

每个阶段产出物必须满足：

1. **lint/format 通过**：前端 `pnpm lint`，后端 `ruff check + mypy --strict`
2. **单元测试 80%+**：每个 task 都先写测试再实现
3. **文件 ≤ 500 行**：ESLint `max-lines: 500` / Python `flake8` 自定义检查
4. **提交粒度小**：一次 task = 一次 commit，且包含测试
5. **类型契约更新**：BE schema 变更 → 重新生成 `packages/shared-types`，FE 引用同步

---

## 工作树策略（COMPLEX scale 强制）

按用户 CLAUDE.md L2 Pipeline + COMPLEX 要求，并行任务必须在独立 git worktree 内执行：

```bash
# 主仓 main 分支 = 集成
# 每个并行任务一个分支 + worktree
git worktree add ../scale-system-be-skeleton -b phase-1/backend-skeleton
git worktree add ../scale-system-fe-infra   -b phase-3/frontend-infrastructure
```

任务完成后通过 PR 合回 main，不直接 push。

---

## 启动顺序

1. 先单独完成 **Phase 0**（脚手架，建仓 + monorepo 结构 + Docker 起空 PG）
2. Phase 0 合并 main 后，并行启动 Phase 1 + Phase 3（两个 worktree、两个 agent）
3. 之后按依赖图推进
