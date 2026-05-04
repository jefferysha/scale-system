# apps/desktop · 桌面端规范

> 与 spec `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md` §5 强绑定。

## 角色

桌面端 = Tauri 壳 + 极少 Rust 桥接代码。React UI 100% 复用 `apps/web` 的代码。

**Rust 部分仅做平台桥接**：
- 本地 SQLite 队列（rusqlite）
- 安全存储（OS keychain / Tauri stronghold）

**串口不在 Rust 实现**：浏览器 Web Serial API 已能读 USB 天平，Tauri webview 同样支持，前端 `apps/web/src/lib/serial/web-serial.ts` 一份代码 Web/Desktop 通吃。

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

## 串口（已迁移）

Rust 侧不再有任何串口 command。前端 `WebSerialAdapter` 直接通过 `navigator.serial` 读 USB 天平；首次使用需在 UI 点"添加设备"触发 Chromium 原生选择器，之后端口持久化授权。
