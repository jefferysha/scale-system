# 天平称重系统

水文泥沙采样实验室的称重数据管理系统。覆盖现场采集、项目/垂线/杯库/称重记录管理、含沙量计算、历史浏览导出、串口天平实时同步、离线幂等同步等完整工作流。

## 架构

```
┌──────────────┐  HTTPS / HTTP  ┌──────────────┐  asyncpg  ┌────────────────┐
│   Web 浏览器  │ ─────────────▶ │              │ ────────▶ │  PostgreSQL 16  │
│ (React 19 +  │                │  FastAPI     │           │  +pg_trgm       │
│  Tailwind v4 │   Web Serial   │  + SQLAlchemy│           │  + JSONB GIN    │
│  + shadcn)   │ ─→ 浏览器串口  │  4 层架构     │           └────────────────┘
└──────────────┘                │  + Alembic    │
                                └──────────────┘
┌──────────────┐  invoke/emit                    
│ Tauri 桌面壳  │ ──→ Rust 串口 + rusqlite 队列
│ (复用 Web UI) │
└──────────────┘
```

详细设计：`docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md`

## 子项目

| 目录 | 内容 | 规范 |
|---|---|---|
| `apps/web/` | React 19 + Vite + Tailwind v4 + shadcn | `apps/web/CLAUDE.md` |
| `apps/api/` | FastAPI + SQLAlchemy 2 + Alembic | `apps/api/CLAUDE.md` |
| `apps/desktop/` | Tauri 2 + Rust 串口/队列桥接 | `apps/desktop/CLAUDE.md` |
| `packages/shared-types/` | OpenAPI → TS 类型契约（自动生成） | — |
| `scripts/` | seed 脚本、数据迁移 | `scripts/README.md` |
| `docker/` | Compose + Dockerfile + nginx | — |
| `docs/` | spec / plans / 部署手册 | — |

## 一键启动（推荐）

```bash
git clone <repo> && cd scale-system
cd docker && cp .env.example .env
docker compose up -d
docker compose exec api python /app/scripts/seed.py   # 建 admin/admin123!
```

打开 http://localhost:8080 用 **admin / admin123!** 登录。

## 开发模式（前后端分跑）

```bash
# 1) 起 PG（保留 5433 端口避开本机 PG）
docker compose -f docker/docker-compose.yml up -d pg

# 2) 起后端
cd apps/api
uv sync --all-extras
cp .env.example .env
uv run alembic upgrade head
uv run python scripts/seed.py
uv run uvicorn scale_api.main:app --reload --port 8000

# 3) 另一终端起前端
pnpm install
pnpm --filter @scale/web dev   # http://localhost:5173

# 4) 桌面端（可选）
pnpm --filter @scale/desktop dev
```

## 测试

```bash
# 前端单元
pnpm --filter @scale/web test

# 前端 E2E（需要先启 BE+PG，会自动 seed admin）
pnpm --filter @scale/web test:e2e

# 后端单元 + 集成
cd apps/api && uv run pytest

# Tauri Rust
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## 数据迁移（一次性）

把现有 Excel 库导入 PG（mock 数据用）：

```bash
docker compose cp /path/to/称重数据库.xlsx api:/tmp/data.xlsx
docker compose exec api sh -c "cd /app && python scripts/seed-from-excel.py --excel /tmp/data.xlsx"
```

实测可导入 3868 cups + 68 records + 8 verticals + 2 projects（幂等可重跑）。

## 文档

| 文件 | 内容 |
|---|---|
| [docs/DEPLOY.md](docs/DEPLOY.md) | 部署手册（含生产清单与回滚） |
| [docs/superpowers/specs/](docs/superpowers/specs/) | 架构设计文档（v1.1，含 Codex 审查反馈 F1-F6） |
| [docs/superpowers/plans/](docs/superpowers/plans/) | 各 Phase 实施计划与实际执行偏差 |
| [CLAUDE.md](CLAUDE.md) | 跨子项目不变量与提交规范 |

## 测试覆盖率（当前 main）

| 域 | 测试数 | 覆盖率 |
|---|---|---|
| 后端 pytest | 83 | 90.15% |
| 前端 vitest | 49 | 81.81% lines / 87.95% branches |
| 前端 Playwright E2E | 28 (14 spec × dark/light) | — |
| 桌面端 cargo test | 35 | — |
| **总计** | **195** | — |

## 开发约束（强制）

1. 所有源代码文件 ≤ 500 行（lint 强制）
2. 后端 4 层依赖单向：api → service → repository → models
3. 前端 feature 不跨 import；服务端态 TanStack Query / 客户端态 Zustand
4. 串口仅通过 `lib/serial/adapter.ts` 接口使用，业务代码不写 `if (isTauri)`
5. 提交消息 Conventional Commits（feat/fix/refactor/docs/test/chore/perf/ci）

详见 [CLAUDE.md](CLAUDE.md) 与 `apps/*/CLAUDE.md`。
