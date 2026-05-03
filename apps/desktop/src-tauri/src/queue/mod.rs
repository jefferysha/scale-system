//! 桌面端离线队列。
//!
//! - 存储：rusqlite + SQLite（bundled，免装系统依赖）
//! - 表 schema：见 `schema.sql`
//! - 状态机：pending → syncing → synced | failed → needs_review（attempt_count >= max）
//!
//! 严禁在此层调后端 API。worker 调度由前端 SyncWorker 负责。

pub mod db;

pub use db::{PendingItem, Queue};
