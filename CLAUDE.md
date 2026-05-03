# scale-system · 根级规范

> 子项目规范见 `apps/*/CLAUDE.md`，本文件只放跨子项目的不变量。

## 跨子项目不变量

1. **设计源**：所有架构决策必须查 `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md`，与之冲突的代码视为 bug。
2. **类型契约**：API 入参出参契约由 OpenAPI 生成的 `packages/shared-types` 单点维护。后端改 schema 必须重新生成；前端只 import 类型，不手写 API 类型。
3. **文件大小**：所有源代码 ≤ 500 行（前端 ESLint `max-lines: 500`、Python `flake8` 检查、Rust 用 `cargo-spellcheck` + 自定义脚本）。超过必须拆。
4. **提交规范**：Conventional Commits（feat/fix/refactor/docs/test/chore/perf/ci）+ scope（如 `feat(api): ...`）。
5. **PR 流程**：每个 phase/feature 单独分支 → PR → review → squash merge。`main` 永远绿。
6. **测试覆盖率**：前后端各自 ≥ 80%。
7. **环境变量**：`.env.example` 列出所有变量；真值进 `.env`（gitignore）。

## 工具链

| 子项目 | 包管理器 | 语言 | Lint | Format |
|---|---|---|---|---|
| `apps/web` | pnpm | TS 5.6+ | ESLint | Prettier |
| `apps/api` | uv | Python 3.12 | ruff | ruff |
| `apps/desktop` | cargo + pnpm | Rust 1.80 + TS | clippy + ESLint | rustfmt + Prettier |

## 任何任务前

- 读对应子项目的 `CLAUDE.md`
- 读 spec 中相关章节
- 改 API → 查 §8.2，改前端 → 查 §4，改后端 → 查 §6，改 DB → 查 §7

## 禁止事项

- 在 `main` 直接 push
- 提交未通过 lint/test 的代码
- 跳过 spec 直接编码
- 在 `apps/*/CLAUDE.md` 之外引入子项目级规范
