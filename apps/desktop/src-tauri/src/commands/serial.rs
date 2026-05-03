//! 串口相关 Tauri commands。
//!
//! 暴露：
//! - `list_ports() -> Vec<PortInfo>`
//! - `open_serial(port_id, config) -> ()`（同时启 stream 线程 emit 事件）
//! - `close_serial() -> ()`
//! - `probe_serial(port_id, config, timeout_ms) -> ProbeResult`

use crate::serial::stream::StreamHandle;
use crate::serial::{connection, protocol, stream, PortInfo, ScaleConfig, SerialError, WeightSample};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// 全局串口状态：当前 stream handle + 已打开 connection。
#[derive(Default)]
pub struct SerialState {
    pub stream: Mutex<Option<StreamHandle>>,
    pub conn: Mutex<Option<Arc<connection::SerialConnection>>>,
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
    // 关旧的
    if let Ok(mut g) = state.stream.lock() {
        if let Some(h) = g.take() {
            h.stop();
        }
    }
    let conn = Arc::new(connection::open(&port_id, &config)?);
    let handle = stream::start_stream(app.clone(), conn.clone());
    *state
        .stream
        .lock()
        .map_err(|_| SerialError::Unknown("state lock poisoned".into()))? = Some(handle);
    *state
        .conn
        .lock()
        .map_err(|_| SerialError::Unknown("state lock poisoned".into()))? = Some(conn);
    Ok(())
}

#[tauri::command]
pub async fn close_serial(state: State<'_, SerialState>) -> Result<(), SerialError> {
    if let Ok(mut g) = state.stream.lock() {
        if let Some(h) = g.take() {
            h.stop();
        }
    }
    if let Ok(mut g) = state.conn.lock() {
        *g = None;
    }
    Ok(())
}

/// 探测端口：开 + 收最多 5 个样本或超时返回。
#[tauri::command]
pub async fn probe_serial(
    port_id: String,
    config: ScaleConfig,
    timeout_ms: u64,
) -> Result<ProbeResult, SerialError> {
    let conn = connection::open(&port_id, &config)?;
    let proto = protocol::from_type(&config.protocol_type);
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
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(sample) = proto.parse_line(trimmed) {
                        samples.push(sample);
                    }
                }
            }
            _ => std::thread::sleep(std::time::Duration::from_millis(50)),
        }
    }

    Ok(ProbeResult {
        ok: !samples.is_empty(),
        samples,
        error: None,
    })
}

#[derive(Serialize)]
pub struct ProbeResult {
    pub ok: bool,
    pub samples: Vec<WeightSample>,
    pub error: Option<SerialError>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> ScaleConfig {
        ScaleConfig {
            baud_rate: 9600,
            data_bits: 8,
            parity: "none".into(),
            stop_bits: 1,
            flow_control: "none".into(),
            protocol_type: "generic".into(),
            read_timeout_ms: 50,
            decimal_places: 4,
            unit_default: "g".into(),
        }
    }

    #[test]
    fn list_ports_command_returns_vec() {
        // 不依赖具体硬件
        let r = list_ports();
        assert!(r.is_ok());
    }

    #[tokio::test]
    async fn probe_nonexistent_port_returns_error() {
        let r = probe_serial("/nonexistent-xyz".into(), cfg(), 50).await;
        assert!(r.is_err());
    }

    #[test]
    fn serial_state_default_empty() {
        let s = SerialState::default();
        assert!(s.stream.lock().unwrap().is_none());
        assert!(s.conn.lock().unwrap().is_none());
    }

    #[test]
    fn probe_result_serializes() {
        let r = ProbeResult {
            ok: true,
            samples: vec![],
            error: None,
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"ok\":true"));
    }
}
