//! 协议 trait，generic 是默认实现，所有 protocol_type 现阶段都映射到 generic。
//! 后续如需 mettler-MT-SICS / sartorius-XL 专属解析，新增 impl 即可。

pub mod generic;

use crate::serial::{SerialError, WeightSample};

pub trait Protocol: Send + Sync {
    fn parse_line(&self, line: &str) -> Result<WeightSample, SerialError>;
}

/// 根据 `protocol_type` 返回一个具体协议实现。
///
/// 暂统一走 generic（手写解析覆盖了 mettler/sartorius/ohaus 的常见输出）。
/// 后续若需要差异化，把这里改成 match 即可。
pub fn from_type(_name: &str) -> Box<dyn Protocol> {
    Box::new(generic::Generic)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_type_generic() {
        let p = from_type("generic");
        let s = p.parse_line("S S 1.0 g").unwrap();
        assert!((s.value - 1.0).abs() < 1e-6);
    }

    #[test]
    fn from_type_unknown_falls_back_to_generic() {
        let p = from_type("doesnt-exist");
        let s = p.parse_line("S S 2.5 g").unwrap();
        assert!((s.value - 2.5).abs() < 1e-6);
    }
}
