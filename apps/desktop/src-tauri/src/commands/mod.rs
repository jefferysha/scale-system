//! Tauri commands。每个文件按业务域分。
//!
//! - `serial`: 串口生命周期 + 探测
//! - `queue`: 离线队列（Task 6.4）

pub mod queue;
pub mod serial;
