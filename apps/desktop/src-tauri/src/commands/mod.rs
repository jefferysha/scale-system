//! Tauri commands。每个文件按业务域分。
//!
//! - `queue`: 离线队列（Task 6.4）
//!
//! 串口由前端 Web Serial API 直读（apps/web/src/lib/serial/web-serial.ts），
//! Rust 侧不再实现串口逻辑，亦无对应 command。

pub mod queue;
