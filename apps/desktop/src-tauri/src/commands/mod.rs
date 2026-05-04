//! Tauri commands。每个文件按业务域分。
//!
//! - `queue`: 离线队列（Task 6.4）
//!
//! 串口相关 command 已废弃：业界最佳实践是后端持有串口 + WebSocket 推前端，
//! 桌面端复用前端的 WebSocketSerialAdapter，不再在 Rust 侧实现串口逻辑。

pub mod queue;
