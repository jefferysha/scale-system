//! 串口桥接层。
//!
//! 仅做 OS 平台桥接（list_ports / open / read_chunk）+ 通用 ASCII 重量帧解析。
//! 严禁包含业务逻辑（含沙量计算、状态机、调后端 API 等）。

pub mod connection;
pub mod parser;
pub mod protocol;
pub mod stream;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 天平串口配置（与前端 ScaleConfig 字段名按 snake_case 对齐）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleConfig {
    pub baud_rate: u32,
    pub data_bits: u8,
    pub parity: String,
    pub stop_bits: u8,
    pub flow_control: String,
    pub protocol_type: String,
    pub read_timeout_ms: u64,
    pub decimal_places: u8,
    pub unit_default: String,
}

/// 一次重量采样。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightSample {
    pub value: f64,
    pub unit: String,
    pub stable: bool,
    pub raw: String,
    pub ts: i64,
}

/// 操作系统识别到的串口端口。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub id: String,
    pub label: String,
    pub vendor: Option<String>,
    pub product: Option<String>,
}

/// 串口/解析错误。`#[serde(tag = "code", content = "message")]` 让前端拿到稳定的
/// `{ code: "...", message: "..." }` 结构。
#[derive(Debug, Error, Serialize, Deserialize)]
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
