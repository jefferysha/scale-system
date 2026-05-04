# 部署手册

## 1 · 一键本地全栈（推荐开发用）

```bash
cd docker
cp .env.example .env       # 按需改 JWT_SECRET / 端口 / PG 密码
docker compose up -d
```

服务起来后：

| 端点 | 用途 |
|---|---|
| http://localhost:8080 | Web 前端（nginx 反代 /api 到后端） |
| http://localhost:8000 | API 直连（开发/调试） |
| http://localhost:8000/docs | OpenAPI 文档 |
| localhost:5433 | PG（外部连接调试用） |

### 初始化账号 + 数据

```bash
# 进 api 容器跑 seed
docker compose exec api python /app/scripts/seed.py
# 默认建 admin/admin123!（已存在则幂等跳过）

# 可选：一次性导入 Excel mock 数据（3868 cups + 68 records）
docker compose cp /Users/jiayin/Downloads/称重数据库.xlsx api:/tmp/data.xlsx
docker compose exec api sh -c "cd /app && python scripts/seed-from-excel.py --excel /tmp/data.xlsx"
```

登录用 admin/admin123! → 浏览器开 http://localhost:8080 。

### 查看日志

```bash
docker compose logs -f api    # 后端实时日志
docker compose logs -f web    # nginx 访问日志
```

### 升级 / 重新 build

```bash
git pull
docker compose build         # 重新打镜像（cache 友好）
docker compose up -d         # 滚动重启
```

### 数据备份

```bash
docker compose exec pg pg_dump -U scale scale_system > backup.sql

# 还原：
cat backup.sql | docker compose exec -T pg psql -U scale scale_system
```

---

## 2 · 端口冲突自定义

如本机 8000/8080/5433 被占用，改 `docker/.env`：

```bash
API_PORT=18000
WEB_PORT=18080
# pg 端口在 compose 中硬编码 5433:5432，如冲突手工改 docker-compose.yml
```

---

## 3 · 桌面端（Tauri）

桌面端不进 Docker，开发：

```bash
pnpm install
pnpm --filter @scale/desktop dev
```

发布：

```bash
pnpm --filter @scale/desktop build
# 产物：apps/desktop/src-tauri/target/release/bundle/{dmg,msi,deb,AppImage}/
```

桌面端默认连 `http://localhost:8000/api/v1`，生产时改 `apps/desktop/src-tauri/tauri.conf.json` 中 `app.security.csp` 的 `connect-src` + 修改前端 `VITE_API_BASE_URL` 重新 build。

---

## 4 · 生产部署清单

上线前必做：

- [ ] **改强密码**：`docker/.env` 中
  - `PG_PASSWORD`（≥ 16 字符强密码）
  - `JWT_SECRET`（≥ 32 字符随机串，建议 `openssl rand -hex 32`）
  - `ALLOWED_ORIGINS` 改成实际域名
- [ ] **HTTPS**：建议在 docker-compose 前加 Caddy/Traefik 自动 cert
- [ ] **PG 备份策略**：每日 cron 跑 `pg_dump`，保留 30 天
- [ ] **Refresh cookie Secure**：HTTPS 启用后 `__Host-` cookie 才会带上（HTTP 下浏览器丢弃）
- [ ] **改 admin 密码**：登录后用 `PUT /api/v1/users/{id}` 改默认 admin123!
- [ ] **审计日志保留**：`audit_logs` 表无定期清理，需自定 cron 或保留全量
- [ ] **监控**：建议接 Grafana + Loki（超出本期范围）

---

## 5 · 常见问题

### "alembic: not found" / API 启动失败

通常是镜像 build 时 venv 路径不一致。**修复**：本项目 builder 与 runtime 都用 `/app` WORKDIR，确保 shebang 一致。如自行修改请保持一致。

### "5432 端口被占"

本机已装 PostgreSQL 时 docker compose 默认映射 `5433:5432` 避开冲突。如还冲突改 `.env` 的 `PG_PORT`（需要在 compose 中加 var）。

### "登录后 401 / 反复跳登录"

HTTP 下 `__Host-refresh` cookie 缺 Secure 会被浏览器丢弃。两个出路：
1. **生产用 HTTPS**（推荐，Caddy 自动 cert）
2. **开发用桌面端**（refresh 走 body 不走 cookie）

### "前端打开是白屏"

清浏览器缓存 + 检查 nginx 日志：

```bash
docker compose logs web
```

### "pnpm install 巨慢"

build 阶段 pnpm 拉依赖在中国大陆可能慢，改 `Dockerfile.web` 加：

```dockerfile
RUN pnpm config set registry https://registry.npmmirror.com
```

---

## 6 · 串口接入：浏览器 Web Serial 直连

### 6.1 架构

天平不再经后端读取，**浏览器（含 Tauri webview）通过 Web Serial API 直接读 USB 串口**，业务后端纯无状态，可任意托管：

```
天平 USB → 浏览器（navigator.serial） → 前端解析 → 录入时 POST → 后端 API → DB
```

后端不再依赖 `pyserial` / `pyserial-asyncio-fast`，没有 WebSocket / 串口模块；从前的 `SCALE_DEFAULT_TRANSPORT`、`socat` 桥、`ser2net` 网关全部不再需要。

### 6.2 浏览器要求

| 项 | 要求 |
|---|---|
| 浏览器 | Chrome / Edge / Opera（Chromium 系）；Safari、Firefox 不支持 |
| 协议 | HTTPS（或 `localhost` / `127.0.0.1` 特例） |
| 用户授权 | 首次必须用户点击"添加设备"按钮在浏览器原生选择器里选中端口；之后页面加载会自动恢复 |
| OS 驱动 | 装好 USB 转串口驱动（CH340 / FTDI / Prolific 等） |

### 6.3 本地开发

Vite dev server 默认 `http://localhost:5173`，`localhost` 是浏览器 secure context 特例，**HTTP 即可使用 Web Serial**，无需 mkcert / HTTPS 配置：

```bash
pnpm dev
# 打开 http://localhost:5173/scales → 点"添加设备" → 选中天平 → 探测
```

如需局域网测试（手机/平板访问 `http://192.168.x.x:5173`），加 `vite-plugin-mkcert`：

```bash
pnpm add -D vite-plugin-mkcert
```

```ts
// vite.config.ts
import mkcert from 'vite-plugin-mkcert';
export default { plugins: [mkcert()], server: { host: true } };
```

### 6.4 生产部署

| 平台 | HTTPS | 是否可直接用 Web Serial |
|---|---|---|
| Vercel | ✅ 自动 | ✅ |
| Zeabur | ✅ 自动 | ✅ |
| 自托管（Nginx + Let's Encrypt） | 需要配置 | ✅ |

后端 Docker 镜像不再需要 `--device` 透传或 `extra_hosts`，普通无状态容器即可。

### 6.5 不接硬件时

浏览器若不支持 Web Serial（Safari / Firefox / SSR），前端自动 fallback 到 `UnsupportedSerialAdapter`，UI 显示离线状态；通过 `?mock=1` 查询参数可启用 `MockSerialAdapter` 做演示。

---

## 7 · 回滚

```bash
docker compose down
git checkout <previous-tag>
docker compose build
docker compose up -d
# alembic 自动 upgrade head；如要回滚 schema：
docker compose exec api alembic downgrade -1
```

---

## 8 · Zeabur 部署（云托管 · 推荐生产用）

### 8.1 拓扑

```
Zeabur Project
├── postgres   ← Marketplace 模板（PostgreSQL 16）
├── api        ← Dockerfile.api（Python uvicorn）
└── web        ← Dockerfile.web（nginx + dist + /api 反代）
```

串口由用户浏览器 Web Serial API 直读（见 §6），云端不需任何串口逻辑。

### 8.2 服务 1 · PostgreSQL

Zeabur 控制台 → **Add Service** → **Marketplace** → **PostgreSQL 16** → 一键部署。

部署后 Variables 标签会自动注入：`POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USERNAME` / `POSTGRES_PASSWORD` / `POSTGRES_DATABASE`。

### 8.3 服务 2 · API

| 字段 | 值 |
|---|---|
| Source | GitHub repo |
| Root Directory | `/` |
| Dockerfile Path | `docker/Dockerfile.api` |
| Build Context | `.` |
| Port | `8000` |
| Health Check | `/health` |

**环境变量**：

```bash
# 注意 driver 必须是 asyncpg
DATABASE_URL=postgresql+asyncpg://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}
JWT_SECRET=<openssl rand -hex 32 生成的真值>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=30
REFRESH_TOKEN_TTL_DAYS=7
ALLOWED_ORIGINS=https://<web 服务的 Zeabur 域名>
APP_ENV=production
LOG_LEVEL=INFO
```

> Dockerfile.api 启动命令自带 `alembic upgrade head`，第一次部署会自动建表。

部署后 → **Networking** 标签开启 **Public Network** → 拿到 `https://api-xxx.zeabur.app`。

跑 seed：服务详情 → **Console** → 运行：
```bash
python /app/scripts/seed.py
```

### 8.4 服务 3 · Web（nginx 反代同源方案）

| 字段 | 值 |
|---|---|
| Source | GitHub repo |
| Dockerfile Path | `docker/Dockerfile.web` |
| Build Context | `.` |
| Port | `80` |

**Build Args**（构建时注入前端）：
```
VITE_API_BASE_URL=/api/v1
```

**环境变量**（运行时注入 nginx）：
```bash
# 指向 api 服务的 Zeabur 内网地址 + 端口
# 推荐用 Service Reference：在 Variables 里点 "Add from Reference" → 选 api 服务
API_UPSTREAM=${API_HOST}:${API_PORT}
# 或手动填，例如：
# API_UPSTREAM=scale-api.zeabur.internal:8000
```

> nginx 容器启动时由 envsubst 把 `${API_UPSTREAM}` 替换进 `/etc/nginx/conf.d/default.conf`，
> 浏览器访问 web 域名即同源拿到 `/api`，**无 CORS、无跨站 cookie 问题**。

部署后 → **Networking** → **Public Network** → 拿到 `https://web-xxx.zeabur.app`。

回到 api 服务把 `ALLOWED_ORIGINS` 改成 web 真实域名 → restart。

### 8.5 验证

- [ ] `https://web-xxx.zeabur.app` 主页正常
- [ ] `https://web-xxx.zeabur.app/health` 返回 200（说明 nginx 反代通到 api）
- [ ] 登录页用 seed 用户登入成功
- [ ] **地址栏是 `https://`**（关键，否则 Web Serial 不工作）
- [ ] Chrome 打开称重页 → 点"连接天平" → 系统授权框 → 选 USB → 数据进来
- [ ] 称重数据落到 Zeabur PG（**Console** 进容器查 records 表）

### 8.6 常见坑

| 现象 | 原因 | 修复 |
|---|---|---|
| Web Serial 按钮无反应 | 不是 HTTPS 或非 Chromium 浏览器 | 用 Chrome 访问 `.zeabur.app` 域名 |
| `/api` 返回 502 | `API_UPSTREAM` 没注入或写错 | Console 里 `cat /etc/nginx/conf.d/default.conf` 检查替换结果 |
| api 卡在启动 | `DATABASE_URL` 用了 `postgresql://` 而非 `postgresql+asyncpg://` | 改环境变量 driver |
| 登录成功但 refresh 401 | nginx 反代时 cookie 没透传 | 已在 nginx.conf 配 `proxy_pass_header Set-Cookie`，确认 envsubst 没破坏配置 |
| nginx 启动报 `unknown variable "uri"` | envsubst 误替换 nginx 内置变量 | Dockerfile.web 已设 `NGINX_ENVSUBST_FILTER=^API_` 白名单，确认未被覆盖 |
