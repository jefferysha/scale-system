//! 通用 ASCII 协议实现，复用 `serial::parser::parse_generic`。

use super::Protocol;
use crate::serial::{parser, SerialError, WeightSample};

pub struct Generic;

impl Protocol for Generic {
    fn parse_line(&self, line: &str) -> Result<WeightSample, SerialError> {
        parser::parse_generic(line)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delegates_to_parser() {
        let s = Generic.parse_line("S S 12.34 g").unwrap();
        assert_eq!(s.unit, "g");
        assert!((s.value - 12.34).abs() < 1e-6);
        assert!(s.stable);
    }
}
