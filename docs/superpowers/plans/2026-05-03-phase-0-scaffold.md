# Phase 0 · 项目脚手架

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。Steps 用 `- [ ]` 跟踪。本 phase 不可并行，是后续所有阶段的基石。

**Goal:** 建立 monorepo 结构，三 app 空跑，Docker Compose 能起空 PG，根 CLAUDE.md 落地。

**Architecture:** pnpm workspaces（前端 + monorepo 工具）+ uv 管理 Python + cargo 管理 Rust。三个 app 在 `apps/`，共享类型在 `packages/shared-types`，Docker 配置在 `docker/`。

**Tech Stack:** pnpm 9 / Node 22 / Python 3.12 + uv / Rust 1.80 + Tauri 2 / PostgreSQL 16

---

## 前置检查

- [ ] **检查工具版本**

```bash
node --version          # 期望 v22+
pnpm --version          # 期望 9+
python3 --version       # 期望 3.12+
which uv || echo "需安装 uv"
cargo --version         # 期望 1.80+
docker --version
docker compose version
```

如有缺失，提示用户安装。

---

## Task 0.1 · 创建 monorepo 根结构

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.nvmrc`
- Create: `README.md`

- [ ] **Step 1:** 写 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2:** 写根 `package.json`

```json
{
  "name": "scale-system",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 3:** 写 `.gitignore`

```gitignore
# Node
node_modules/
.pnpm-store/
*.log
dist/
build/
coverage/
.turbo/

# Python
__pycache__/
*.pyc
.venv/
.pytest_cache/
.mypy_cache/
.ruff_cache/
htmlcov/

# Rust
target/

# Tauri
src-tauri/target/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Env
.env
.env.local
.env.*.local

# Tauri build
*.dmg
*.msi
*.AppImage

# DB
*.sqlite
*.sqlite3
pgdata/
```

- [ ] **Step 4:** 写 `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.{py,rs}]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 5:** 写 `.nvmrc`

```
22
```

- [ ] **Step 6:** 写 `README.md`

```markdown
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
```

- [ ] **Step 7:** 提交

```bash
git add package.json pnpm-workspace.yaml .gitignore .editorconfig .nvmrc README.md
git commit -m "chore(scaffold): monorepo 根结构与 pnpm workspaces"
```

---

## Task 0.2 · 根 CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1:** 写根 `CLAUDE.md`

```markdown
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
```

- [ ] **Step 2:** 提交

```bash
git add CLAUDE.md
git commit -m "docs(scaffold): 根级 CLAUDE.md"
```

---

## Task 0.3 · 后端 app 空壳（apps/api）

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/.python-version`
- Create: `apps/api/src/scale_api/__init__.py`
- Create: `apps/api/src/scale_api/main.py`
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/test_health.py`
- Create: `apps/api/.env.example`
- Create: `apps/api/README.md`
- Create: `apps/api/CLAUDE.md`
- Create: `apps/api/package.json` （让 pnpm 能识别）

- [ ] **Step 1:** 写 `apps/api/pyproject.toml`

```toml
[project]
name = "scale-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "sqlalchemy>=2.0.36",
  "asyncpg>=0.29.0",
  "alembic>=1.13.3",
  "pydantic>=2.9.0",
  "pydantic-settings>=2.6.0",
  "python-jose[cryptography]>=3.3.0",
  "passlib[bcrypt]>=1.7.4",
  "python-multipart>=0.0.12",
  "slowapi>=0.1.9",
  "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3.3",
  "pytest-asyncio>=0.24.0",
  "pytest-cov>=5.0.0",
  "testcontainers[postgres]>=4.8.0",
  "ruff>=0.7.0",
  "mypy>=1.13.0",
  "factory-boy>=3.3.1",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "SIM", "TCH"]
ignore = []

[tool.mypy]
strict = true
python_version = "3.12"
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=src/scale_api --cov-report=term-missing --cov-fail-under=80"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/scale_api"]
```

- [ ] **Step 2:** 写 `.python-version`

```
3.12
```

- [ ] **Step 3:** 写 `apps/api/src/scale_api/__init__.py`

```python
"""scale_api - 天平称重系统后端."""
__version__ = "0.1.0"
```

- [ ] **Step 4:** 先写测试 `apps/api/tests/test_health.py`

```python
"""Health 端点烟雾测试."""
from fastapi.testclient import TestClient

from scale_api.main import app


def test_health_endpoint_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "scale-api"}
```

- [ ] **Step 5:** 跑测试，确认 fail

```bash
cd apps/api && uv run pytest tests/test_health.py -v
```

期望：`ModuleNotFoundError: No module named 'scale_api.main'` 或 import 失败。

- [ ] **Step 6:** 写最小实现 `apps/api/src/scale_api/main.py`

```python
"""FastAPI 应用入口."""
from fastapi import FastAPI

app = FastAPI(
    title="Scale API",
    version="0.1.0",
    description="天平称重系统后端",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "scale-api"}
```

- [ ] **Step 7:** 跑测试，确认 pass

```bash
uv run pytest tests/test_health.py -v
```

期望：`1 passed`。

- [ ] **Step 8:** 写 `apps/api/.env.example`

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://scale:scalepass@localhost:5432/scale_system

# JWT
JWT_SECRET=change-me-to-a-real-secret-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=30
REFRESH_TOKEN_TTL_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:5173

# 应用
APP_ENV=development
LOG_LEVEL=INFO
```

- [ ] **Step 9:** 写 `apps/api/CLAUDE.md`

```markdown
# apps/api · 后端规范

> 与 spec `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md` §6 / §7 / §8 / §11 强绑定。

## 4 层架构（强制单向依赖）

```
api/v1/*.py  ──▶  services/*.py  ──▶  repositories/*.py  ──▶  models/*.py
                       │
                       └─▶ schemas/*.py（DTO）
```

- **api 层**：FastAPI 路由，仅做 HTTP 入参出参 + 调用 service
- **service 层**：业务逻辑。**禁止 import models**，只通过 repository
- **repository 层**：唯一可以写 SQLAlchemy query 的地方
- **models / schemas 严格分离**：models 是 DB 结构，schemas 是 API 契约

## 强制规则

1. 所有 API 入参出参用 Pydantic schema，**禁止**直接返回 ORM 对象
2. 数据库写操作必须在事务里 + 写 `audit_logs`
3. 异常用 `core/exceptions.py` 中定义的业务异常类，**禁止**裸 `raise HTTPException`
4. 文件 ≤ 500 行（超过拆按 §6.4 的预拆分计划）
5. 数据库变更必须先 `alembic revision --autogenerate`，**禁止**手改表结构
6. 测试覆盖率 ≥ 80%（pytest-cov 强制）
7. 所有公开 API 必须有 OpenAPI tag + summary + 响应示例

## 依赖管理

```bash
uv sync                    # 装依赖
uv add <pkg>               # 加运行时依赖
uv add --dev <pkg>         # 加开发依赖
```

## 常用命令

```bash
uv run uvicorn scale_api.main:app --reload    # 启动开发
uv run pytest                                 # 跑测试
uv run ruff check .                           # lint
uv run ruff format .                          # 格式化
uv run mypy src                               # 类型检查
uv run alembic revision --autogenerate -m "msg"  # 生成迁移
uv run alembic upgrade head                   # 应用迁移
```

## 复杂模块拆分（spec §6.4）

新增/修改下列模块时必须按此拆分，不允许合并：
- `api/v1/records.py` → records_query.py / records_mutation.py / records_batch.py
- `services/record_service.py` → record_validator.py / record_calculator.py / record_batch_processor.py
- `repositories/record_repo.py` → record_query_builder.py
- `api/v1/scales.py` → scales_admin.py（管理员独立）

## 安全

- 密码：bcrypt cost=12
- Access token：30 min，**仅** body 返回，不写 cookie
- Refresh token：7 d，仅哈希入库 + 强制轮换 + reuse 检测
- 见 §11 全章
```

- [ ] **Step 10:** 写 `apps/api/README.md`

```markdown
# scale-api

FastAPI 后端服务。

## 启动

```bash
uv sync
cp .env.example .env
docker compose -f ../../docker/docker-compose.yml up -d pg
uv run alembic upgrade head
uv run uvicorn scale_api.main:app --reload --port 8000
```

打开 http://localhost:8000/docs 看 OpenAPI。

## 测试

```bash
uv run pytest
```
```

- [ ] **Step 11:** 写 `apps/api/package.json`（仅供 pnpm 识别）

```json
{
  "name": "@scale/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "uv run uvicorn scale_api.main:app --reload --port 8000",
    "test": "uv run pytest",
    "lint": "uv run ruff check .",
    "typecheck": "uv run mypy src",
    "build": "echo 'Python no build'"
  }
}
```

- [ ] **Step 12:** 装依赖 + 跑测试

```bash
cd apps/api
uv sync --all-extras
uv run pytest -v
```

期望：测试全部通过。

- [ ] **Step 13:** 提交

```bash
git add apps/api/
git commit -m "feat(api): FastAPI 空壳 + health 端点 + 4 层架构 CLAUDE.md"
```

---

## Task 0.4 · 前端 app 空壳（apps/web）

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/eslint.config.js`
- Create: `apps/web/.prettierrc`
- Create: `apps/web/CLAUDE.md`
- Create: `apps/web/README.md`
- Create: `apps/web/.env.example`

- [ ] **Step 1:** 写 `apps/web/package.json`

```json
{
  "name": "@scale/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@tanstack/react-query": "^5.59.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.7",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.453.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0-beta.3",
    "@tailwindcss/vite": "^4.0.0-beta.3",
    "eslint": "^9.13.0",
    "@eslint/js": "^9.13.0",
    "typescript-eslint": "^8.10.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.14",
    "prettier": "^3.3.3",
    "vitest": "^2.1.3",
    "@vitest/coverage-v8": "^2.1.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.2",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "msw": "^2.4.11",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2:** 写 `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3:** 写 `apps/web/tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4:** 写 `apps/web/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 5:** 写 `apps/web/index.html`

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>天平称重系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6:** 写 `apps/web/src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7:** 写 `apps/web/src/App.tsx`

```tsx
export default function App() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">天平称重系统</h1>
        <p className="mt-2 text-sm text-slate-400">脚手架已就绪</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8:** 写 `apps/web/src/styles/globals.css`

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Geist', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
}
```

- [ ] **Step 9:** 写 `apps/web/eslint.config.js`

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022 },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 10:** 写 `apps/web/.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

- [ ] **Step 11:** 写 `apps/web/.env.example`

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

- [ ] **Step 12:** 写 `apps/web/CLAUDE.md`

```markdown
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
```

- [ ] **Step 13:** 写 `apps/web/README.md`

```markdown
# scale-web

React 19 + Vite + Tailwind + shadcn 前端。

```bash
pnpm install
pnpm dev    # http://localhost:5173
```
```

- [ ] **Step 14:** 写 `apps/web/src/test/setup.ts`

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 15:** 写一个烟雾测试 `apps/web/src/App.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the system title', () => {
    render(<App />);
    expect(screen.getByText('天平称重系统')).toBeInTheDocument();
  });
});
```

- [ ] **Step 16:** 装依赖 + 跑测试 + lint

```bash
cd apps/web
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

期望：全部 pass，dist/ 生成。

- [ ] **Step 17:** 提交

```bash
git add apps/web/
git commit -m "feat(web): React 19 + Vite + Tailwind v4 空壳 + 烟雾测试"
```

---

## Task 0.5 · 桌面端 app 空壳（apps/desktop）

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/icons/` （从 Tauri 模板复制）
- Create: `apps/desktop/CLAUDE.md`
- Create: `apps/desktop/README.md`

- [ ] **Step 1:** 写 `apps/desktop/package.json`

```json
{
  "name": "@scale/desktop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "tauri": "tauri",
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "cargo test --manifest-path src-tauri/Cargo.toml",
    "lint": "cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings",
    "typecheck": "cargo check --manifest-path src-tauri/Cargo.toml"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.1.0"
  }
}
```

- [ ] **Step 2:** 写 `apps/desktop/src-tauri/Cargo.toml`

```toml
[package]
name = "scale-desktop"
version = "0.1.0"
description = "天平称重系统桌面端"
edition = "2021"
rust-version = "1.80"

[lib]
name = "scale_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-shell = "2.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.41", features = ["full"] }
tokio-serial = "5.4"
serialport = "4.6"
rusqlite = { version = "0.32", features = ["bundled"] }
uuid = { version = "1.11", features = ["v4", "serde"] }
thiserror = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
tokio-test = "0.4"
```

- [ ] **Step 3:** 写 `apps/desktop/src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4:** 写 `apps/desktop/src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2.0.0",
  "productName": "Scale System",
  "version": "0.1.0",
  "identifier": "com.scalesystem.desktop",
  "build": {
    "beforeDevCommand": "pnpm --filter @scale/web dev",
    "beforeBuildCommand": "pnpm --filter @scale/web build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../../web/dist"
  },
  "app": {
    "windows": [
      {
        "title": "天平称重系统",
        "width": 1440,
        "height": 900,
        "minWidth": 1280,
        "minHeight": 720,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:8000"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 5:** 写 `apps/desktop/src-tauri/src/lib.rs`

```rust
//! Scale Desktop · Tauri 桥接层
//!
//! 仅做 OS 桥接（串口、本地队列、安全存储）。业务逻辑放前端 React。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_pong() {
        assert_eq!(ping(), "pong");
    }
}
```

- [ ] **Step 6:** 写 `apps/desktop/src-tauri/src/main.rs`

```rust
// 防止 Windows 上启动多余的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    scale_desktop_lib::run()
}
```

- [ ] **Step 7:** 准备 icons 目录（从 Tauri 模板下载默认 icon）

```bash
mkdir -p apps/desktop/src-tauri/icons
cd apps/desktop/src-tauri/icons
# 临时用 Tauri 默认 icon 占位（后续替换为产品 logo）
curl -L https://github.com/tauri-apps/tauri/raw/dev/examples/api/src-tauri/icons/icon.png -o icon.png
# 用 tauri icon 命令生成所有规格
cd ../..
pnpm tauri icon src-tauri/icons/icon.png
```

注：若 `pnpm tauri icon` 不可用，从 https://tauri.app/v2/start/create-project 模板复制 6 个标准尺寸 icon。

- [ ] **Step 8:** 写 `apps/desktop/CLAUDE.md`

```markdown
# apps/desktop · 桌面端规范

> 与 spec `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md` §5 强绑定。

## 角色

桌面端 = Tauri 壳 + 极少 Rust 桥接代码。React UI 100% 复用 `apps/web` 的代码。

**Rust 部分仅做平台桥接**：
- 串口（tokio-serial / serialport）
- 本地 SQLite 队列（rusqlite）
- 安全存储（OS keychain / Tauri stronghold）

## 强制规则

1. **不**在 Rust 端实现业务逻辑（认证、含沙量计算、记录管理 → 全部走前端调中心 API）
2. 所有 Tauri command 必须有 `#[tauri::command]` + 参数 + 返回类型 + 错误类型
3. 前端通过 `lib/platform.ts` 检测环境，**不**在业务代码里写 `if (isTauri())`
4. Rust 文件 ≤ 500 行
5. 离线队列 schema 改动必须配迁移脚本
6. **不允许**在 Rust 端直接调后端 HTTP API（让前端去调）
7. clippy 必须 0 warning
8. 每个 command 都有 `#[cfg(test)]` 单元测试

## 常用命令

```bash
pnpm dev               # tauri dev（同时拉起前端）
pnpm build             # 打包 dmg/msi/AppImage
pnpm test              # cargo test
pnpm lint              # cargo clippy
pnpm typecheck         # cargo check
```

## 串口 command 契约

参考 spec §4.4 的 SerialAdapter 接口，Rust 侧需实现：
- `list_ports() -> Vec<PortInfo>`
- `open_serial(config, port_id) -> Result<()>`
- `close_serial() -> Result<()>`
- `probe_serial(config, port_id, timeout_ms) -> ProbeResult`

事件 emit：
- `scale-status`、`scale-weight`、`scale-error`
```

- [ ] **Step 9:** 写 `apps/desktop/README.md`

```markdown
# scale-desktop

Tauri 桌面壳。

```bash
pnpm install
pnpm dev    # 启动桌面应用（同时拉起前端 dev server）
```
```

- [ ] **Step 10:** 跑 cargo check + test

```bash
cd apps/desktop
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

期望：编译通过，`ping_returns_pong` 测试 pass。

- [ ] **Step 11:** 提交

```bash
git add apps/desktop/
git commit -m "feat(desktop): Tauri 2 空壳 + ping command + 桥接层 CLAUDE.md"
```

---

## Task 0.6 · shared-types 包

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/README.md`

- [ ] **Step 1:** 写 `packages/shared-types/package.json`

```json
{
  "name": "@scale/shared-types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "generate": "echo 'TODO: 接 openapi-typescript'",
    "test": "echo 'no tests yet'",
    "lint": "echo 'no lint yet'",
    "typecheck": "tsc --noEmit",
    "build": "echo 'no build needed'"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "openapi-typescript": "^7.4.0"
  }
}
```

- [ ] **Step 2:** 写 `packages/shared-types/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3:** 写 `packages/shared-types/src/index.ts`

```ts
/**
 * Shared API types between FE and BE.
 *
 * Phase 1 之后，本文件由 openapi-typescript 自动从 BE 的 OpenAPI 生成。
 * 当前先做占位，避免 import 不到。
 */

export interface HealthResponse {
  status: 'ok';
  service: string;
}
```

- [ ] **Step 4:** 写 `packages/shared-types/README.md`

```markdown
# @scale/shared-types

API 类型契约的单一来源。Phase 1 之后由 BE 的 OpenAPI schema 自动生成。

## 重新生成

```bash
# BE 起来后
pnpm --filter @scale/shared-types generate
```
```

- [ ] **Step 5:** 提交

```bash
pnpm install        # 触发 workspace link
git add packages/shared-types/ pnpm-lock.yaml
git commit -m "feat(shared-types): 占位 API 类型契约包"
```

---

## Task 0.7 · Docker Compose（仅 PG）

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/.env.example`
- Create: `docker/init-db/01-extensions.sql`
- Create: `docker/Dockerfile.api` （占位，Phase 9 完善）
- Create: `docker/Dockerfile.web` （占位，Phase 9 完善）

- [ ] **Step 1:** 写 `docker/docker-compose.yml`

```yaml
services:
  pg:
    image: postgres:16-alpine
    container_name: scale-pg
    environment:
      POSTGRES_USER: ${PG_USER:-scale}
      POSTGRES_PASSWORD: ${PG_PASSWORD:-scalepass}
      POSTGRES_DB: ${PG_DB:-scale_system}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d:ro
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${PG_USER:-scale}']
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  pgdata:
```

- [ ] **Step 2:** 写 `docker/.env.example`

```bash
PG_USER=scale
PG_PASSWORD=scalepass
PG_DB=scale_system
```

- [ ] **Step 3:** 写 `docker/init-db/01-extensions.sql`

```sql
-- 启用必需扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

- [ ] **Step 4:** 写 `docker/Dockerfile.api`（占位，Phase 9 完善）

```dockerfile
# Phase 9 完善
FROM python:3.12-slim
WORKDIR /app
RUN echo "TODO: Phase 9"
```

- [ ] **Step 5:** 写 `docker/Dockerfile.web`（占位）

```dockerfile
# Phase 9 完善
FROM nginx:alpine
RUN echo "TODO: Phase 9"
```

- [ ] **Step 6:** 启动 PG 验证

```bash
cd docker
cp .env.example .env
docker compose up -d pg
docker compose ps
docker compose exec pg pg_isready -U scale
docker compose exec pg psql -U scale -d scale_system -c "SELECT extname FROM pg_extension;"
```

期望：`pg_trgm` 和 `uuid-ossp` 都在扩展列表中。

- [ ] **Step 7:** 关 PG（释放端口）

```bash
docker compose down
```

- [ ] **Step 8:** 提交

```bash
git add docker/
git commit -m "feat(docker): Compose 起 PG 16 + pg_trgm/uuid-ossp 扩展"
```

---

## Task 0.8 · CI 骨架（GitHub Actions）

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1:** 写 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @scale/web lint
      - run: pnpm --filter @scale/web typecheck
      - run: pnpm --filter @scale/web test
      - run: pnpm --filter @scale/web build

  api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: scale
          POSTGRES_PASSWORD: scalepass
          POSTGRES_DB: scale_system_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install uv
      - run: uv sync --all-extras
        working-directory: apps/api
      - run: uv run ruff check .
        working-directory: apps/api
      - run: uv run mypy src
        working-directory: apps/api
      - run: uv run pytest
        working-directory: apps/api
        env:
          DATABASE_URL: postgresql+asyncpg://scale:scalepass@localhost:5432/scale_system_test

  desktop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - name: Install Tauri prereqs
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
      - run: pnpm install --frozen-lockfile
      - run: cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
      - run: cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings
      - run: cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- [ ] **Step 2:** 提交

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions 三 app 并行 lint/test/build"
```

---

## Task 0.9 · 验证与文档

- [ ] **Step 1:** 全量自检

```bash
# 根目录
pnpm install
pnpm typecheck

# 前端
pnpm --filter @scale/web test
pnpm --filter @scale/web lint
pnpm --filter @scale/web build

# 后端
cd apps/api
uv sync --all-extras
uv run pytest
uv run ruff check .
cd ../..

# 桌面端
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml

# Docker
cd docker
cp .env.example .env
docker compose up -d pg
docker compose ps
docker compose down
cd ..
```

期望：全部 green，无 warning。

- [ ] **Step 2:** 更新根 `README.md` 添加"快速验证"段落

(在 README.md 的"快速开始"后追加)

```markdown
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
```

- [ ] **Step 3:** 提交收尾

```bash
git add README.md
git commit -m "docs: 添加脚手架快速验证步骤"
```

- [ ] **Step 4:** 打 tag

```bash
git tag -a phase-0-complete -m "Phase 0: 脚手架完成"
```

---

## Phase 0 完成标志

✅ pnpm workspaces 三 app 可识别
✅ `apps/api` FastAPI health 端点 + pytest pass
✅ `apps/web` Vite + React 19 + Tailwind 烟雾测试 + build pass
✅ `apps/desktop` Tauri 2 + cargo test pass
✅ `packages/shared-types` 占位类型可 import
✅ Docker Compose 起 PG 16 + 扩展 ready
✅ CI workflow 配置完整
✅ 三个 CLAUDE.md（web/api/desktop）+ 根 CLAUDE.md 落地
✅ 所有提交可追溯 phase-0-complete tag

---

## 下一步

Phase 0 合并 main 后启动两个 worktree：

```bash
git worktree add ../scale-system-be-skeleton -b phase-1/backend-skeleton
git worktree add ../scale-system-fe-infra   -b phase-3/frontend-infrastructure
```

Phase 1 plan：`docs/superpowers/plans/2026-05-03-phase-1-backend-skeleton.md`
Phase 3 plan：`docs/superpowers/plans/2026-05-03-phase-3-frontend-infrastructure.md`
