# 天平称重系统

水文泥沙采样实验室的称重数据管理系统。

## 子项目

- `apps/web/` — React 19 + Vite Web 客户端
- `apps/api/` — FastAPI + PostgreSQL 后端
- `apps/desktop/` — Tauri 桌面壳

## 文档

- 设计：`docs/superpowers/specs/`
- 实施计划：`docs/superpowers/plans/`

## 快速开始

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d pg
pnpm --filter api dev
pnpm --filter web dev
```

详见各子项目 README.md 和 CLAUDE.md。

## 快速验证脚手架

```bash
pnpm install
pnpm typecheck
pnpm --filter @scale/web test
pnpm --filter @scale/web build
cd apps/api && uv sync --all-extras && uv run pytest && cd ../..
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
docker compose -f docker/docker-compose.yml up -d pg
```
