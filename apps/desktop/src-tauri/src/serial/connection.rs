//! 串口生命周期：list / open / read_chunk。

use crate::serial::{PortInfo, ScaleConfig, SerialError};
use serialport::{available_ports, DataBits, FlowControl, Parity, SerialPort, StopBits};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// 已打开的串口句柄。`port` 用 `Arc<Mutex<...>>` 包裹以便在 stream 线程间共享。
pub struct SerialConnection {
    port: Arc<Mutex<Box<dyn SerialPort>>>,
    config: ScaleConfig,
}

/// 列出当前操作系统识别到的所有串口端口。
pub fn list_ports() -> Result<Vec<PortInfo>, SerialError> {
    let ports = available_ports().map_err(|e| SerialError::IoError(e.to_string()))?;
    Ok(ports
        .into_iter()
        .map(|p| {
            let (vendor, product) = match &p.port_type {
                serialport::SerialPortType::UsbPort(usb) => {
                    (usb.manufacturer.clone(), usb.product.clone())
                }
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

/// 打开指定串口。
pub fn open(port_id: &str, config: &ScaleConfig) -> Result<SerialConnection, SerialError> {
    let data_bits = match config.data_bits {
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        n => {
            return Err(SerialError::OpenFailed(format!(
                "unsupported data_bits {n}"
            )))
        }
    };
    let parity = match config.parity.as_str() {
        "none" => Parity::None,
        "even" => Parity::Even,
        "odd" => Parity::Odd,
        s => return Err(SerialError::OpenFailed(format!("unsupported parity {s}"))),
    };
    let stop_bits = match config.stop_bits {
        1 => StopBits::One,
        2 => StopBits::Two,
        n => {
            return Err(SerialError::OpenFailed(format!(
                "unsupported stop_bits {n}"
            )))
        }
    };
    let flow_control = match config.flow_control.as_str() {
        "none" => FlowControl::None,
        "hardware" => FlowControl::Hardware,
        s => {
            return Err(SerialError::OpenFailed(format!(
                "unsupported flow_control {s}"
            )))
        }
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

    Ok(SerialConnection {
        port: Arc::new(Mutex::new(port)),
        config: config.clone(),
    })
}

impl SerialConnection {
    /// 读一段字节，timeout 由 `ScaleConfig::read_timeout_ms` 决定。
    pub fn read_chunk(&self, buf: &mut [u8]) -> Result<usize, SerialError> {
        let mut p = self
            .port
            .lock()
            .map_err(|_| SerialError::IoError("mutex poisoned".into()))?;
        match p.read(buf) {
            Ok(n) => Ok(n),
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => Err(SerialError::Timeout),
            Err(e) => Err(SerialError::IoError(e.to_string())),
        }
    }

    pub fn config(&self) -> &ScaleConfig {
        &self.config
    }
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
            read_timeout_ms: 100,
            decimal_places: 4,
            unit_default: "g".into(),
        }
    }

    #[test]
    fn list_ports_does_not_panic() {
        let _ = list_ports();
    }

    #[test]
    fn open_with_invalid_data_bits_errors() {
        let mut c = cfg();
        c.data_bits = 9;
        let r = open("/nonexistent", &c);
        assert!(matches!(r, Err(SerialError::OpenFailed(_))));
    }

    #[test]
    fn open_with_invalid_parity_errors() {
        let mut c = cfg();
        c.parity = "weird".into();
        let r = open("/nonexistent", &c);
        assert!(matches!(r, Err(SerialError::OpenFailed(_))));
    }

    #[test]
    fn open_with_invalid_stop_bits_errors() {
        let mut c = cfg();
        c.stop_bits = 3;
        let r = open("/nonexistent", &c);
        assert!(matches!(r, Err(SerialError::OpenFailed(_))));
    }

    #[test]
    fn open_with_invalid_flow_control_errors() {
        let mut c = cfg();
        c.flow_control = "magic".into();
        let r = open("/nonexistent", &c);
        assert!(matches!(r, Err(SerialError::OpenFailed(_))));
    }

    #[test]
    fn open_nonexistent_port_returns_error() {
        let r = open("/nonexistent-port-xyz", &cfg());
        assert!(r.is_err());
    }
}
