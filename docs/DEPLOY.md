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

## 6 · 串口接入：本地真天平 / 生产远程网关

### 6.1 传输层抽象（同一份代码三种部署）

后端通过环境变量 `SCALE_DEFAULT_TRANSPORT` 配置串口连接 URL，pyserial 原生支持：

| URL 形式 | 用途 | 部署形态 |
|---|---|---|
| `serial:///dev/cu.usbserial-AB01` | 本地直读 USB | API 进程跑在天平所在机器（**Linux Docker `--device`** 也可） |
| `socket://host:port` | 通过 TCP 桥读串口 | **Mac/Win Docker** + 宿主机 socat / 跨网段 ser2net |
| `loop://` | 内存回环 | 单元测试 |

代码层 0 改动，只换 ENV。

### 6.2 macOS / Windows Docker 接真天平（首选方案）

Mac/Win Docker Desktop 跑在 Hypervisor 虚拟机里，**USB 设备透传不进容器**——这是 Apple/MS 设计如此。**业界标准做法是用宿主机 socat 起 TCP 桥**。

```bash
# 一次安装 socat
brew install socat   # macOS
# 或 sudo apt install socat   # Linux

# 插上天平，找端口
ls /dev/cu.usbserial-* /dev/cu.SLAB_* /dev/cu.usbmodem*
# 假设结果: /dev/cu.usbserial-AB01

# 起桥（前台跑，Ctrl-C 停）
./scripts/dev/serial-bridge.sh /dev/cu.usbserial-AB01

# 也可设置波特率/帧格式：
BAUD=4800 PARITY=even DATA_BITS=7 ./scripts/dev/serial-bridge.sh /dev/cu.usbserial-AB01
```

桥跑起来后，docker container 内 API 通过 `socket://host.docker.internal:6500` 透明读到真天平字节流。在 `docker/.env` 中加：

```bash
SCALE_DEFAULT_TRANSPORT=socket://host.docker.internal:6500
```

`docker-compose.yml` 给 api 服务加 `extra_hosts`（Linux 上才需要，Mac/Win Docker 自带）：

```yaml
api:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

### 6.3 Linux Docker 接真天平

Linux Docker 支持 USB 设备直通，更简单：

```yaml
api:
  devices:
    - "/dev/ttyUSB0:/dev/ttyUSB0"
  environment:
    SCALE_DEFAULT_TRANSPORT: "serial:///dev/ttyUSB0"
```

### 6.4 生产远程网关（多站点）

天平所在工作站跑 `ser2net`（socat 的工业版，支持 systemd），把串口暴露成 TCP；中心服务器的 API container 通过 TCP 读：

```bash
# 在天平所在机器（Linux/Win，安装 ser2net）
ser2net -d -C "6500:raw:0:/dev/ttyUSB0:9600 8DATABITS NONE 1STOPBIT"

# 中心服务器 API ENV
SCALE_DEFAULT_TRANSPORT=tcp://workstation.local:6500
```

### 6.5 不接硬件时

不传 `SCALE_DEFAULT_TRANSPORT` 时后端仅启用 REST/WS endpoints 但所有连接尝试会返回 `UNCONFIGURED` 错误，前端 Header 会显示离线状态。

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
