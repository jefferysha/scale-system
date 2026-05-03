//! 后台读串口线程：按行拆帧，调 `Protocol::parse_line`，emit 给前端。
//!
//! 事件：
//! - `scale-status`: ConnectionState（"opening" / "connected" / "reading" / "disconnected"）
//! - `scale-weight`: WeightSample
//! - `scale-error` : SerialError（带 code + message 的对象）

use crate::serial::connection::SerialConnection;
use crate::serial::protocol::from_type;
use crate::serial::SerialError;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// 控制后台流的句柄。drop 不停流，需要显式 `stop()`。
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
        let _ = app.emit("scale-status", "reading");

        let mut buf = vec![0u8; 256];
        let mut line_buf = String::new();

        loop {
            if stop_clone.load(Ordering::SeqCst) {
                break;
            }
            match conn.read_chunk(&mut buf) {
                Ok(0) => {
                    std::thread::sleep(Duration::from_millis(50));
                }
                Ok(n) => {
                    let s = String::from_utf8_lossy(&buf[..n]);
                    line_buf.push_str(&s);
                    while let Some(idx) = line_buf.find('\n') {
                        let line: String = line_buf.drain(..=idx).collect();
                        let trimmed = line.trim_end_matches(['\r', '\n']);
                        if trimmed.is_empty() {
                            continue;
                        }
                        match proto.parse_line(trimmed) {
                            Ok(sample) => {
                                let _ = app.emit("scale-weight", &sample);
                            }
                            Err(e) => {
                                let _ = app.emit("scale-error", &e);
                            }
                        }
                    }
                }
                Err(SerialError::Timeout) => continue,
                Err(e) => {
                    let _ = app.emit("scale-error", &e);
                    break;
                }
            }
        }
        let _ = app.emit("scale-status", "disconnected");
    });

    StreamHandle { stop }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_handle_stop_flips_flag() {
        let stop = Arc::new(AtomicBool::new(false));
        let h = StreamHandle { stop: stop.clone() };
        assert!(!stop.load(Ordering::SeqCst));
        h.stop();
        assert!(stop.load(Ordering::SeqCst));
    }
}
