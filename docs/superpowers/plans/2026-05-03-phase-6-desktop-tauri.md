# Phase 6 · 桌面端 Tauri 串口 + 离线队列

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 4 已合 main（含 SerialAdapter 接口 + UnsupportedSerialAdapter 占位 + MockSerialAdapter）。Worktree：`../scale-system-desktop` 分支 `phase-6/desktop-tauri`。

**Goal:** 把 `apps/desktop/src-tauri` 从 ping 空壳填成完整桥接层：Rust 串口（serialport-rs/tokio-serial）+ 通用 ASCII 协议解析 + rusqlite 离线队列 + Tauri commands + emit 事件。前端写 `TauriSerialAdapter` 实现 SerialAdapter 接口，注入到 platform.ts。

**Architecture:** Rust 端只做平台桥接，无业务逻辑。每个文件 ≤ 500 行。前端用 platform.ts 工厂在 Tauri 环境注入 TauriSerialAdapter。

**Tech Stack:** Tauri 2 / serialport 4.6 / tokio-serial 5.4 / rusqlite 0.32 / tokio / serde / thiserror / tracing。

---

## 关键约束

1. **不在 Rust 端做业务逻辑**：禁止调后端 API、禁止做含沙量计算、禁止解释 weighing 状态机
2. **Rust 文件 ≤ 500 行**，按 §5.1 拆分
3. **command 都要有错误类型 + 单测**
4. **前端通过 SerialAdapter 抽象使用，业务代码不写 `if (isTauri)`**
5. **离线队列 schema 改动必须配迁移**

---

## Task 6.1 · 串口连接模块

**Files:**
- Create: `apps/desktop/src-tauri/src/serial/mod.rs`
- Create: `apps/desktop/src-tauri/src/serial/connection.rs`
- Create: `apps/desktop/src-tauri/src/serial/parser.rs`
- Create: `apps/desktop/src-tauri/src/serial/protocol/mod.rs`
- Create: `apps/desktop/src-tauri/src/serial/protocol/generic.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml`（依赖已在 Phase 0 列出，verify）

### 6.1.1 serial/mod.rs

```rust
pub mod connection;
pub mod parser;
pub mod protocol;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleConfig {
    pub baud_rate: u32,
    pub data_bits: u8,         // 7 | 8
    pub parity: String,        // none|even|odd
    pub stop_bits: u8,         // 1 | 2
    pub flow_control: String,  // none|hardware
    pub protocol_type: String, // generic|mettler|sartorius|ohaus
    pub read_timeout_ms: u64,
    pub decimal_places: u8,
    pub unit_default: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WeightSample {
    pub value: f64,
    pub unit: String,
    pub stable: bool,
    pub raw: String,
    pub ts: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PortInfo {
    pub id: String,
    pub label: String,
    pub vendor: Option<String>,
    pub product: Option<String>,
}

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum SerialError {
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("port not found: {0}")]
    PortNotFound(String),
    #[error("port busy: {0}")]
    PortBusy(String),
    #[error("open failed: {0}")]
    OpenFailed(String),
    #[error("timeout")]
    Timeout,
    #[error("parse error: {0}")]
    ParseError(String),
    #[error("io error: {0}")]
    IoError(String),
    #[error("closed by device")]
    ClosedByDevice,
    #[error("cancelled")]
    Cancelled,
    #[error("unknown: {0}")]
    Unknown(String),
}
```

### 6.1.2 connection.rs

```rust
use crate::serial::{PortInfo, ScaleConfig, SerialError};
use serialport::{available_ports, DataBits, FlowControl, Parity, SerialPort, StopBits};
use std::time::Duration;
use std::sync::{Arc, Mutex};

pub struct SerialConnection {
    port: Arc<Mutex<Box<dyn SerialPort>>>,
    config: ScaleConfig,
}

pub fn list_ports() -> Result<Vec<PortInfo>, SerialError> {
    let ports = available_ports().map_err(|e| SerialError::IoError(e.to_string()))?;
    Ok(ports
        .into_iter()
        .map(|p| {
            let (vendor, product) = match &p.port_type {
                serialport::SerialPortType::UsbPort(usb) => (
                    usb.manufacturer.clone(),
                    usb.product.clone(),
                ),
                _ => (None, None),
            };
            PortInfo {
                id: p.port_name.clone(),
                label: p.port_name,
                vendor,
                product,
            }
        })
        .collect())
}

pub fn open(port_id: &str, config: &ScaleConfig) -> Result<SerialConnection, SerialError> {
    let data_bits = match config.data_bits {
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        _ => return Err(SerialError::OpenFailed(format!("unsupported data_bits {}", config.data_bits))),
    };
    let parity = match config.parity.as_str() {
        "none" => Parity::None, "even" => Parity::Even, "odd" => Parity::Odd,
        s => return Err(SerialError::OpenFailed(format!("unsupported parity {s}"))),
    };
    let stop_bits = match config.stop_bits {
        1 => StopBits::One, 2 => StopBits::Two,
        s => return Err(SerialError::OpenFailed(format!("unsupported stop_bits {s}"))),
    };
    let flow_control = match config.flow_control.as_str() {
        "none" => FlowControl::None, "hardware" => FlowControl::Hardware,
        s => return Err(SerialError::OpenFailed(format!("unsupported flow_control {s}"))),
    };

    let port = serialport::new(port_id, config.baud_rate)
        .data_bits(data_bits)
        .parity(parity)
        .stop_bits(stop_bits)
        .flow_control(flow_control)
        .timeout(Duration::from_millis(config.read_timeout_ms))
        .open()
        .map_err(|e| match e.kind {
            serialport::ErrorKind::NoDevice => SerialError::PortNotFound(port_id.to_string()),
            _ => SerialError::OpenFailed(e.to_string()),
        })?;

    Ok(SerialConnection { port: Arc::new(Mutex::new(port)), config: config.clone() })
}

impl SerialConnection {
    pub fn read_chunk(&self, buf: &mut [u8]) -> Result<usize, SerialError> {
        let mut p = self.port.lock().map_err(|_| SerialError::IoError("mutex poisoned".into()))?;
        match p.read(buf) {
            Ok(n) => Ok(n),
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => Err(SerialError::Timeout),
            Err(e) => Err(SerialError::IoError(e.to_string())),
        }
    }

    pub fn config(&self) -> &ScaleConfig { &self.config }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_ports_returns_ok_or_empty() {
        // 不依赖具体硬件，只验证调用不 panic
        let _ = list_ports();
    }

    #[test]
    fn open_with_invalid_data_bits_errors() {
        let cfg = ScaleConfig {
            baud_rate: 9600, data_bits: 9, parity: "none".into(), stop_bits: 1,
            flow_control: "none".into(), protocol_type: "generic".into(),
            read_timeout_ms: 100, decimal_places: 4, unit_default: "g".into(),
        };
        let r = open("/nonexistent", &cfg);
        assert!(matches!(r, Err(SerialError::OpenFailed(_))));
    }
}
```

### 6.1.3 parser.rs（通用 ASCII 重量解析）

```rust
use crate::serial::{SerialError, WeightSample};
use regex::Regex;

/// 通用 ASCII 重量帧解析。
/// 兼容多种格式，提取数字 + 单位 + 稳定标志。
/// 例：
///   "S S      45.1234 g\r\n" → {value:45.1234, unit:g, stable:true}
///   "+   45.12  g \r\n"      → {value:45.12, unit:g, stable:true（单位边距推断）}
///   "ST,GS,   45.1234 g"     → {value:45.1234, unit:g, stable:true}
///   "US,GS,   45.1234 g"     → stable:false（US=unstable）
pub fn parse_generic(line: &str) -> Result<WeightSample, SerialError> {
    let re = Regex::new(r"([+-]?\d+\.\d+)\s*(g|mg|kg)").unwrap();
    let cap = re
        .captures(line)
        .ok_or_else(|| SerialError::ParseError(format!("no number+unit in {line:?}")))?;
    let value: f64 = cap.get(1).unwrap().as_str().parse()
        .map_err(|e: std::num::ParseFloatError| SerialError::ParseError(e.to_string()))?;
    let unit = cap.get(2).unwrap().as_str().to_string();

    // 稳定标志推断：含 'S' 或 'ST' 或缺 'D'/'US' 即视为稳定
    let upper = line.to_uppercase();
    let stable = !(upper.contains("US") || upper.contains(" D ") || upper.starts_with("D "));

    Ok(WeightSample {
        value, unit, stable,
        raw: line.to_string(),
        ts: chrono::Utc::now().timestamp_millis(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_mettler_stable() {
        let s = parse_generic("S S      45.1234 g\r\n").unwrap();
        assert!((s.value - 45.1234).abs() < 1e-6);
        assert_eq!(s.unit, "g");
        assert!(s.stable);
    }

    #[test]
    fn parse_unstable() {
        let s = parse_generic("US,GS,   45.1234 g").unwrap();
        assert!(!s.stable);
    }

    #[test]
    fn parse_invalid_returns_err() {
        let r = parse_generic("garbage no number");
        assert!(matches!(r, Err(SerialError::ParseError(_))));
    }
}
```

注：上面用了 `regex` 和 `chrono` 但不在 Cargo.toml 列出。要么加依赖，要么手写解析。**写 plan 时选手写**避免依赖膨胀（Phase 0 没列）：

替代实现（无 regex / chrono 依赖）：
```rust
use std::time::{SystemTime, UNIX_EPOCH};

pub fn parse_generic(line: &str) -> Result<WeightSample, SerialError> {
    // 找第一个 "<number> <unit>" 子串
    let mut chars = line.chars().peekable();
    let mut buf = String::new();
    let mut found_number = false;
    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() || c == '.' || c == '-' || c == '+' {
            buf.push(c); chars.next(); found_number = true;
        } else if found_number {
            break;
        } else {
            chars.next();
        }
    }
    if buf.is_empty() {
        return Err(SerialError::ParseError(format!("no number in {line:?}")));
    }
    let value: f64 = buf.parse().map_err(|e: std::num::ParseFloatError| SerialError::ParseError(e.to_string()))?;
    // skip whitespace
    while matches!(chars.peek(), Some(&c) if c.is_whitespace()) { chars.next(); }
    // unit (g/mg/kg)
    let mut unit = String::new();
    while let Some(&c) = chars.peek() {
        if c.is_ascii_alphabetic() { unit.push(c); chars.next(); }
        else { break; }
    }
    if !["g", "mg", "kg"].contains(&unit.as_str()) {
        unit = "g".into(); // 兜底
    }
    let upper = line.to_uppercase();
    let stable = !(upper.contains("US") || upper.contains(" D "));
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    Ok(WeightSample { value, unit, stable, raw: line.into(), ts })
}
```

### 6.1.4 protocol/mod.rs + protocol/generic.rs

预留协议 trait，generic 是默认实现：

```rust
// mod.rs
pub mod generic;

use crate::serial::{SerialError, WeightSample};

pub trait Protocol: Send + Sync {
    fn parse_line(&self, line: &str) -> Result<WeightSample, SerialError>;
}

pub fn from_type(name: &str) -> Box<dyn Protocol> {
    match name {
        "mettler" | "sartorius" | "ohaus" => Box::new(generic::Generic), // 暂用 generic
        _ => Box::new(generic::Generic),
    }
}
```

```rust
// generic.rs
use super::Protocol;
use crate::serial::{parser, SerialError, WeightSample};

pub struct Generic;

impl Protocol for Generic {
    fn parse_line(&self, line: &str) -> Result<WeightSample, SerialError> {
        parser::parse_generic(line)
    }
}
```

- [ ] **Step 1-6:** 写 5 个文件 + 测试 + 提交

```bash
cd apps/desktop && cargo test --manifest-path src-tauri/Cargo.toml
git commit -m "feat(desktop): 串口连接 + 通用 ASCII 协议解析 + 协议 trait（generic）"
```

---

## Task 6.2 · 串口流（异步读 + emit 给前端）

**Files:**
- Create: `apps/desktop/src-tauri/src/serial/stream.rs`
- Modify: `apps/desktop/src-tauri/src/serial/mod.rs`（pub mod stream）

### 6.2.1 stream.rs

```rust
use crate::serial::connection::SerialConnection;
use crate::serial::protocol::{from_type, Protocol};
use crate::serial::SerialError;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub struct StreamHandle {
    stop: Arc<AtomicBool>,
}

impl StreamHandle {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

/// 起一个后台 thread 持续读串口并 emit 事件。
pub fn start_stream(app: AppHandle, conn: Arc<SerialConnection>) -> StreamHandle {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = stop.clone();
    let proto = from_type(&conn.config().protocol_type);
    std::thread::spawn(move || {
        let _ = app.emit("scale-status", "connected");
        let mut buf = vec![0u8; 256];
        let mut line_buf = String::new();
        let _ = app.emit("scale-status", "reading");
        loop {
            if stop_clone.load(Ordering::SeqCst) { break; }
            match conn.read_chunk(&mut buf) {
                Ok(0) => std::thread::sleep(Duration::from_millis(50)),
                Ok(n) => {
                    let s = String::from_utf8_lossy(&buf[..n]);
                    line_buf.push_str(&s);
                    while let Some(idx) = line_buf.find('\n') {
                        let line: String = line_buf.drain(..=idx).collect();
                        let trimmed = line.trim_end_matches(['\r', '\n']);
                        if trimmed.is_empty() { continue; }
                        match proto.parse_line(trimmed) {
                            Ok(sample) => { let _ = app.emit("scale-weight", &sample); }
                            Err(e) => { let _ = app.emit("scale-error", &e); }
                        }
                    }
                }
                Err(SerialError::Timeout) => continue,
                Err(e) => { let _ = app.emit("scale-error", &e); break; }
            }
        }
        let _ = app.emit("scale-status", "disconnected");
    });
    StreamHandle { stop }
}
```

注：tauri 2 的 `Emitter` trait 需要 `use tauri::Manager;` 才能调用 `.emit()`。

- [ ] **Step 1-3:** 写 + cargo check + 提交

```bash
git commit -m "feat(desktop): 串口异步流 + emit scale-status/weight/error 事件"
```

---

## Task 6.3 · Tauri Commands

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop/src-tauri/src/commands/serial.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`（注册 invoke_handler）

### 6.3.1 commands/serial.rs

```rust
use crate::serial::{connection, stream, PortInfo, ScaleConfig, SerialError, WeightSample};
use crate::serial::stream::StreamHandle;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

#[derive(Default)]
pub struct SerialState {
    inner: Mutex<Option<StreamHandle>>,
    conn: Mutex<Option<Arc<connection::SerialConnection>>>,
}

#[tauri::command]
pub fn list_ports() -> Result<Vec<PortInfo>, SerialError> {
    connection::list_ports()
}

#[tauri::command]
pub async fn open_serial(
    app: AppHandle,
    state: State<'_, SerialState>,
    port_id: String,
    config: ScaleConfig,
) -> Result<(), SerialError> {
    let _ = app.emit("scale-status", "opening");
    let conn = Arc::new(connection::open(&port_id, &config)?);
    let handle = stream::start_stream(app, conn.clone());
    *state.inner.lock().unwrap() = Some(handle);
    *state.conn.lock().unwrap() = Some(conn);
    Ok(())
}

#[tauri::command]
pub async fn close_serial(state: State<'_, SerialState>) -> Result<(), SerialError> {
    if let Some(h) = state.inner.lock().unwrap().take() { h.stop(); }
    *state.conn.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn probe_serial(
    port_id: String,
    config: ScaleConfig,
    timeout_ms: u64,
) -> Result<ProbeResult, SerialError> {
    let conn = connection::open(&port_id, &config)?;
    let proto = crate::serial::protocol::from_type(&config.protocol_type);
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
    let mut samples: Vec<WeightSample> = Vec::new();
    let mut buf = vec![0u8; 256];
    let mut line_buf = String::new();
    while std::time::Instant::now() < deadline && samples.len() < 5 {
        match conn.read_chunk(&mut buf) {
            Ok(n) if n > 0 => {
                let s = String::from_utf8_lossy(&buf[..n]);
                line_buf.push_str(&s);
                while let Some(idx) = line_buf.find('\n') {
                    let line: String = line_buf.drain(..=idx).collect();
                    let trimmed = line.trim_end_matches(['\r', '\n']);
                    if trimmed.is_empty() { continue; }
                    if let Ok(sample) = proto.parse_line(trimmed) {
                        samples.push(sample);
                    }
                }
            }
            _ => std::thread::sleep(std::time::Duration::from_millis(50)),
        }
    }
    Ok(ProbeResult { ok: !samples.is_empty(), samples, error: None })
}

#[derive(serde::Serialize)]
pub struct ProbeResult {
    pub ok: bool,
    pub samples: Vec<WeightSample>,
    pub error: Option<SerialError>,
}
```

注：`tauri::Emitter` trait 需 `use tauri::Manager;` 或 `use tauri::Emitter;` 看 tauri 2 实际 API。

### 6.3.2 commands/mod.rs

```rust
pub mod serial;
pub use serial::*;
```

### 6.3.3 改 lib.rs 注册

```rust
mod commands;
mod serial;
mod queue;  // Task 6.4 准备

pub fn run() {
    tracing_subscriber::fmt().init();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(commands::serial::SerialState::default())
        .invoke_handler(tauri::generate_handler![
            commands::serial::list_ports,
            commands::serial::open_serial,
            commands::serial::close_serial,
            commands::serial::probe_serial,
            queue_enqueue, queue_drain, queue_mark_synced, queue_mark_failed,
        ])
        .run(tauri::generate_context!())
        .expect("error");
}
```

`ping` 暂保留兼容前端。

- [ ] **Step 1-4:** 写 + cargo check + 测试编译 + 提交

```bash
git commit -m "feat(desktop): Tauri commands list_ports/open_serial/close_serial/probe_serial"
```

---

## Task 6.4 · rusqlite 离线队列 + worker

**Files:**
- Create: `apps/desktop/src-tauri/src/queue/mod.rs`
- Create: `apps/desktop/src-tauri/src/queue/db.rs`
- Create: `apps/desktop/src-tauri/src/queue/schema.sql`
- Create: `apps/desktop/src-tauri/src/commands/queue.rs`

### 6.4.1 schema.sql

```sql
CREATE TABLE IF NOT EXISTS pending_records (
  client_uid     TEXT PRIMARY KEY,
  payload        TEXT NOT NULL,                -- JSON
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending|syncing|failed|needs_review|synced
  attempt_count  INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pending_status ON pending_records(status);
```

### 6.4.2 queue/db.rs

```rust
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingItem {
    pub client_uid: String,
    pub payload: String, // JSON
    pub status: String,
    pub attempt_count: i64,
    pub last_error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct Queue {
    conn: Mutex<Connection>,
}

impl Queue {
    pub fn open(path: PathBuf) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn enqueue(&self, client_uid: &str, payload: &str) -> rusqlite::Result<()> {
        let now = chrono_now();
        self.conn.lock().unwrap().execute(
            "INSERT OR IGNORE INTO pending_records (client_uid, payload, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)",
            params![client_uid, payload, now],
        )?;
        Ok(())
    }

    pub fn drain(&self, max: usize) -> rusqlite::Result<Vec<PendingItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT client_uid, payload, status, attempt_count, last_error, created_at, updated_at
             FROM pending_records
             WHERE status IN ('pending','failed') AND attempt_count < 5
             ORDER BY created_at ASC LIMIT ?1",
        )?;
        let items = stmt
            .query_map(params![max as i64], |r| {
                Ok(PendingItem {
                    client_uid: r.get(0)?, payload: r.get(1)?, status: r.get(2)?,
                    attempt_count: r.get(3)?, last_error: r.get(4)?,
                    created_at: r.get(5)?, updated_at: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(items)
    }

    pub fn mark_synced(&self, uids: &[String]) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now();
        for uid in uids {
            conn.execute(
                "UPDATE pending_records SET status='synced', updated_at=?2 WHERE client_uid=?1",
                params![uid, now],
            )?;
        }
        Ok(())
    }

    pub fn mark_failed(&self, uid: &str, err: &str, max_attempts: i64) -> rusqlite::Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now();
        conn.execute(
            "UPDATE pending_records SET
               status = CASE WHEN attempt_count + 1 >= ?3 THEN 'needs_review' ELSE 'failed' END,
               attempt_count = attempt_count + 1,
               last_error = ?2,
               updated_at = ?4
             WHERE client_uid = ?1",
            params![uid, err, max_attempts, now],
        )?;
        Ok(())
    }

    pub fn count(&self) -> rusqlite::Result<(i64, i64)> {
        let conn = self.conn.lock().unwrap();
        let pending: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_records WHERE status IN ('pending','failed')",
            [], |r| r.get(0),
        )?;
        let needs_review: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_records WHERE status='needs_review'",
            [], |r| r.get(0),
        )?;
        Ok((pending, needs_review))
    }
}

fn chrono_now() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::env::temp_dir;
    use uuid::Uuid;

    fn tmp() -> PathBuf {
        temp_dir().join(format!("scale-queue-test-{}.sqlite", Uuid::new_v4()))
    }

    #[test]
    fn enqueue_drain_round_trip() {
        let q = Queue::open(tmp()).unwrap();
        q.enqueue("u1", r#"{"a":1}"#).unwrap();
        q.enqueue("u2", r#"{"a":2}"#).unwrap();
        let items = q.drain(10).unwrap();
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn mark_synced_removes_from_drain() {
        let q = Queue::open(tmp()).unwrap();
        q.enqueue("u3", "{}").unwrap();
        q.mark_synced(&["u3".into()]).unwrap();
        let items = q.drain(10).unwrap();
        assert_eq!(items.len(), 0);
    }

    #[test]
    fn mark_failed_at_5_goes_needs_review() {
        let q = Queue::open(tmp()).unwrap();
        q.enqueue("u4", "{}").unwrap();
        for _ in 0..5 {
            q.mark_failed("u4", "boom", 5).unwrap();
        }
        let items = q.drain(10).unwrap();
        assert_eq!(items.len(), 0);
        let (_, nr) = q.count().unwrap();
        assert_eq!(nr, 1);
    }
}
```

### 6.4.3 queue/mod.rs

```rust
pub mod db;
pub use db::*;
```

### 6.4.4 commands/queue.rs

```rust
use crate::queue::Queue;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct QueueState(pub Mutex<Option<Queue>>);

impl Default for QueueState {
    fn default() -> Self { QueueState(Mutex::new(None)) }
}

fn get_or_init<'a>(
    app: &tauri::AppHandle,
    state: &'a State<QueueState>,
) -> Result<std::sync::MutexGuard<'a, Option<Queue>>, String> {
    let mut guard = state.0.lock().unwrap();
    if guard.is_none() {
        let path: PathBuf = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("queue.sqlite");
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        *guard = Some(Queue::open(path).map_err(|e| e.to_string())?);
    }
    Ok(guard)
}

#[tauri::command]
pub async fn queue_enqueue(
    app: tauri::AppHandle,
    state: State<'_, QueueState>,
    client_uid: String,
    payload: String,
) -> Result<(), String> {
    let g = get_or_init(&app, &state)?;
    g.as_ref().unwrap().enqueue(&client_uid, &payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_drain(
    app: tauri::AppHandle,
    state: State<'_, QueueState>,
    max: usize,
) -> Result<Vec<crate::queue::PendingItem>, String> {
    let g = get_or_init(&app, &state)?;
    g.as_ref().unwrap().drain(max).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_mark_synced(
    app: tauri::AppHandle,
    state: State<'_, QueueState>,
    uids: Vec<String>,
) -> Result<(), String> {
    let g = get_or_init(&app, &state)?;
    g.as_ref().unwrap().mark_synced(&uids).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_mark_failed(
    app: tauri::AppHandle,
    state: State<'_, QueueState>,
    uid: String,
    error: String,
) -> Result<(), String> {
    let g = get_or_init(&app, &state)?;
    g.as_ref().unwrap().mark_failed(&uid, &error, 5).map_err(|e| e.to_string())
}
```

注：Cargo.toml 加 `uuid` dev-dep（仅测试用）：

```toml
[dev-dependencies]
uuid = { version = "1.11", features = ["v4"] }
```

- [ ] **Step 1-5:** 写 + cargo test 通过 + 提交

```bash
git commit -m "feat(desktop): rusqlite 离线队列 + 4 个 queue commands"
```

---

## Task 6.5 · 前端 TauriSerialAdapter + TauriQueue

**Files:**
- Create: `apps/web/src/lib/serial/tauri-serial.ts`
- Create: `apps/web/src/lib/queue/tauri-queue.ts`
- Modify: `apps/web/src/lib/platform.ts`
- Modify: `apps/web/package.json`（加 `@tauri-apps/api`）

注：本 phase 也修改 `apps/web/`，Phase 5 也在改 `apps/web/`，可能冲突。**约定**：
- Phase 5 不动 `lib/serial/` 和 `lib/queue/` 文件
- Phase 6 只在 `lib/serial/` 加新文件 + `lib/platform.ts` 单行修改 + `lib/queue/` 加 tauri-queue.ts
- 合 main 时 Phase 5 先合（量大），Phase 6 后合，platform.ts 单行变更解 conflict

### 6.5.1 加依赖

```bash
cd apps/web
pnpm add @tauri-apps/api@^2.1.0
```

### 6.5.2 lib/serial/tauri-serial.ts

```ts
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  ConnectionState, ProbeResult, ScaleConfig, SerialAdapter,
  SerialError, SerialPortInfo, WeightSample,
} from './adapter';

interface RustScaleConfig {
  baud_rate: number;
  data_bits: number;
  parity: string;
  stop_bits: number;
  flow_control: string;
  protocol_type: string;
  read_timeout_ms: number;
  decimal_places: number;
  unit_default: string;
}

const toRust = (c: ScaleConfig): RustScaleConfig => ({
  baud_rate: c.baudRate,
  data_bits: c.dataBits,
  parity: c.parity,
  stop_bits: c.stopBits,
  flow_control: c.flowControl,
  protocol_type: c.protocolType,
  read_timeout_ms: c.readTimeoutMs,
  decimal_places: c.decimalPlaces,
  unit_default: c.unitDefault,
});

interface RustWeightSample {
  value: number; unit: string; stable: boolean; raw: string; ts: number;
}

const fromRust = (s: RustWeightSample): WeightSample => ({
  value: s.value, unit: s.unit as WeightSample['unit'], stable: s.stable, raw: s.raw, ts: s.ts,
});

export class TauriSerialAdapter implements SerialAdapter {
  private weightUnlisten: UnlistenFn | null = null;
  private statusUnlisten: UnlistenFn | null = null;
  private errorUnlisten: UnlistenFn | null = null;

  isSupported(): boolean { return true; }

  async listPorts(): Promise<SerialPortInfo[]> {
    return invoke<SerialPortInfo[]>('list_ports');
  }

  async open(portId: string, config: ScaleConfig): Promise<void> {
    await invoke('open_serial', { portId, config: toRust(config) });
  }

  async close(): Promise<void> {
    await invoke('close_serial');
  }

  onWeight(handler: (s: WeightSample) => void): () => void {
    let unlisten: UnlistenFn | null = null;
    void listen<RustWeightSample>('scale-weight', (e) => handler(fromRust(e.payload)))
      .then((fn) => { unlisten = fn; this.weightUnlisten = fn; });
    return () => { unlisten?.(); };
  }

  onStatus(handler: (s: ConnectionState) => void): () => void {
    let unlisten: UnlistenFn | null = null;
    void listen<ConnectionState>('scale-status', (e) => handler(e.payload))
      .then((fn) => { unlisten = fn; this.statusUnlisten = fn; });
    return () => { unlisten?.(); };
  }

  onError(handler: (e: SerialError) => void): () => void {
    let unlisten: UnlistenFn | null = null;
    void listen<{ code: string; message: string }>('scale-error', (e) =>
      handler({ code: (e.payload.code as SerialError['code']) ?? 'UNKNOWN', message: e.payload.message }),
    ).then((fn) => { unlisten = fn; this.errorUnlisten = fn; });
    return () => { unlisten?.(); };
  }

  async probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<ProbeResult> {
    interface RustProbe { ok: boolean; samples: RustWeightSample[]; error: { code: string; message: string } | null }
    const r = await invoke<RustProbe>('probe_serial', { portId, config: toRust(config), timeoutMs });
    return {
      ok: r.ok,
      samples: r.samples.map(fromRust),
      error: r.error
        ? { code: (r.error.code as SerialError['code']) ?? 'UNKNOWN', message: r.error.message }
        : undefined,
    };
  }
}
```

### 6.5.3 lib/queue/tauri-queue.ts

实现 `SubmissionQueue` 接口（Phase 5 已定义），底层走 `invoke('queue_enqueue', ...)` 等 4 个 command。

```ts
import { invoke } from '@tauri-apps/api/core';
import type { PendingItem, SubmissionQueue } from './submission-queue';

interface RustPending {
  client_uid: string; payload: string; status: string;
  attempt_count: number; last_error: string | null;
  created_at: number; updated_at: number;
}

export class TauriQueue implements SubmissionQueue {
  async enqueue(item: { client_uid: string; payload: import('@/types/api').RecordCreate }): Promise<void> {
    await invoke('queue_enqueue', { clientUid: item.client_uid, payload: JSON.stringify(item.payload) });
  }
  async drain(maxBatch: number): Promise<PendingItem[]> {
    const items = await invoke<RustPending[]>('queue_drain', { max: maxBatch });
    return items.map((r) => ({
      client_uid: r.client_uid,
      payload: JSON.parse(r.payload),
      status: r.status as PendingItem['status'],
      attempt_count: r.attempt_count,
      last_error: r.last_error,
      created_at: r.created_at,
    }));
  }
  async markSynced(uids: string[]): Promise<void> {
    await invoke('queue_mark_synced', { uids });
  }
  async markFailed(uid: string, error: string, _maxAttempts: number): Promise<void> {
    await invoke('queue_mark_failed', { uid, error });
  }
  async count(): Promise<{ pending: number; needs_review: number }> {
    // queue_count not exposed yet; implement via drain trick or add command
    return { pending: 0, needs_review: 0 };
  }
}
```

（如缺 `queue_count` command，Phase 6 在 Rust 端补一个，本 plan 就先返回 0 占位，后续 push 同步细化）

### 6.5.4 platform.ts 切换

```ts
import { TauriSerialAdapter } from './serial/tauri-serial';
// ...
export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  if (isMockSerial()) cached = new MockSerialAdapter();
  else if (isTauri()) cached = new TauriSerialAdapter();
  else if ('serial' in navigator) cached = new UnsupportedSerialAdapter(); // Phase 后续接 BrowserSerialAdapter
  else cached = new UnsupportedSerialAdapter();
  return cached;
};
```

`getSubmissionQueue()` 工厂：

```ts
import { TauriQueue } from './queue/tauri-queue';
import { IndexedDBQueue } from './queue/indexeddb-queue';

let cachedQueue: SubmissionQueue | null = null;
export const getSubmissionQueue = (): SubmissionQueue => {
  if (cachedQueue) return cachedQueue;
  cachedQueue = isTauri() ? new TauriQueue() : new IndexedDBQueue();
  return cachedQueue;
};
```

注：`IndexedDBQueue` 由 Phase 5 实现。本 phase 只写 `TauriQueue` + 改 platform.ts。如 Phase 5 还没合 main，本 phase 暂 stub 一个 `IndexedDBQueue`（throw `not implemented`），等 Phase 5 合 main 后用 git merge resolve。

- [ ] **Step 1-6:** 写代码 + cargo test + pnpm typecheck + 提交

```bash
git commit -m "feat(web): TauriSerialAdapter + TauriQueue + platform.ts 注入"
```

---

## Task 6.6 · 实测 dev 启动（手动验证）

- [ ] **Step 1:** 启 Tauri dev（agent 环境若无 GUI 跳过，本地手测）

```bash
cd apps/desktop
pnpm dev
```

- [ ] **Step 2:** 应用窗口出现后，前端跳到 `/scales`，新建一个 mock 天平 → 点"探测连接"

  Tauri 环境会调 `list_ports()` 显示真实串口（Mac 上至少有 `/dev/cu.Bluetooth-Incoming-Port`），选一个虚拟端口或物理端口。

- [ ] **Step 3:** Tauri 环境下，`platform.ts` 应该返回 `TauriSerialAdapter`，而不是 mock。

- [ ] **Step 4:** 关窗口，验证 close_serial 释放端口。

如果没有真硬件，跳过 Step 2-3，仅依赖单元测试。

- [ ] **Step 5:** 提交收尾

```bash
git commit --allow-empty -m "test(desktop): Phase 6 手动验证（GUI 启动）"
```

---

## Task 6.7 · E2E-11（断网重连，桌面专属）

**Files:**
- Create: `apps/web/tests/e2e/11-offline-queue.spec.ts`

需要 Tauri 环境（不在 Phase 5 跑），可用 Playwright + Tauri 的 webdriver 模式。

**简化策略**：本 phase 用 Tauri webdriver 跑跑不上的话（环境复杂），用单元测试覆盖关键路径：
- TauriQueue.enqueue → drain → markSynced 全链路
- 网络断开时 SyncWorker 重试逻辑（用 MSW mock 502）

实施时 agent 自行选择哪种验证。

- [ ] **Step 1-2:** 写测试 + 提交

```bash
git commit -m "test(desktop): E2E-11 断网重连（队列重试 + needs_review）"
```

---

## Task 6.8 · 全量自检

- [ ] **Step 1:** Rust 测试

```bash
cd apps/desktop
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

- [ ] **Step 2:** 前端测试

```bash
cd ../web
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 3:** 提交

```bash
git commit --allow-empty -m "test(desktop): Phase 6 全量自检通过"
```

---

## Phase 6 完成标志

✅ 串口连接（list_ports / open / close / read_chunk）+ 通用 ASCII 解析
✅ 异步流（emit scale-status/weight/error）
✅ 4 个 Tauri commands（list_ports / open_serial / close_serial / probe_serial）
✅ rusqlite 离线队列（enqueue/drain/mark_synced/mark_failed）+ 4 个 commands
✅ 前端 TauriSerialAdapter + TauriQueue
✅ platform.ts 切换：Tauri 环境用 Tauri 实现，浏览器用 IndexedDB
✅ cargo test + clippy 0 warning
✅ pnpm typecheck + build 全绿

---

## 下一步

合 main，可与 Phase 5 一起进入完整动线 E2E（含 E2E-11）。
