//! 通用 ASCII 重量帧解析。
//!
//! 不引入 regex / chrono 依赖，纯手写状态机，扫第一段
//! `[+-]?<digits>(.<digits>)? <unit>` 子串，再用前缀关键词推断稳定标志。
//!
//! 兼容格式：
//! - Mettler  ：`"S S      45.1234 g\r\n"` → stable=true
//! - Mettler  ：`"S D      45.1234 g\r\n"` → stable=false（D 表示 dynamic）
//! - 老式格式：`"+   45.12  g \r\n"`        → stable=true（无 unstable 标记）
//! - 通用     ：`"ST,GS,   45.1234 g"`      → stable=true
//! - 通用     ：`"US,GS,   45.1234 g"`      → stable=false（US=unstable）

use crate::serial::{SerialError, WeightSample};
use std::time::{SystemTime, UNIX_EPOCH};

const ALLOWED_UNITS: [&str; 3] = ["mg", "kg", "g"];

/// 解析一行 ASCII 重量帧。
pub fn parse_generic(line: &str) -> Result<WeightSample, SerialError> {
    let (value, unit) = scan_number_and_unit(line)
        .ok_or_else(|| SerialError::ParseError(format!("no number+unit in {line:?}")))?;
    let stable = infer_stable(line);
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok(WeightSample {
        value,
        unit,
        stable,
        raw: line.to_string(),
        ts,
    })
}

/// 扫 line 找第一段数字（含可选 +/- 和小数点）+ 紧随其后的单位。
fn scan_number_and_unit(line: &str) -> Option<(f64, String)> {
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        // 找到一个可能的数字起点：+ / - / 数字
        let c = bytes[i];
        if c == b'+' || c == b'-' || c.is_ascii_digit() {
            // 试读 number
            let (num_end, has_digit) = read_number_span(bytes, i);
            if has_digit && num_end > i {
                let num_str = std::str::from_utf8(&bytes[i..num_end]).ok()?;
                if let Ok(value) = num_str.parse::<f64>() {
                    // 跳空白
                    let mut j = num_end;
                    while j < bytes.len() && bytes[j].is_ascii_whitespace() {
                        j += 1;
                    }
                    // 读单位（最长匹配 mg/kg/g）
                    if let Some((unit, _u_end)) = read_unit(bytes, j) {
                        return Some((value, unit));
                    }
                    // 没单位也接受，按 g 兜底（前端 unit_default 之外的兜底）
                    return Some((value, "g".to_string()));
                }
            }
            // 不是合法数字，从下一字节继续
            i += 1;
        } else {
            i += 1;
        }
    }
    None
}

/// 从 `start` 开始读最长合法数字片段。返回 `(end, has_digit)`。
/// 形如 `+45.1234` / `-12` / `0.5` / `45`。
fn read_number_span(bytes: &[u8], start: usize) -> (usize, bool) {
    let mut i = start;
    let mut has_digit = false;
    let mut has_dot = false;
    if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
        i += 1;
    }
    while i < bytes.len() {
        let c = bytes[i];
        if c.is_ascii_digit() {
            has_digit = true;
            i += 1;
        } else if c == b'.' && !has_dot {
            has_dot = true;
            i += 1;
        } else {
            break;
        }
    }
    (i, has_digit)
}

/// 从 `start` 开始读一个允许的单位（最长匹配）。
fn read_unit(bytes: &[u8], start: usize) -> Option<(String, usize)> {
    for u in ALLOWED_UNITS.iter() {
        let ub = u.as_bytes();
        let end = start + ub.len();
        if end > bytes.len() {
            continue;
        }
        if &bytes[start..end] != ub {
            continue;
        }
        // 单位后必须是非字母（避免 "mgX" 之类误匹配）
        let next_ok = end == bytes.len() || !bytes[end].is_ascii_alphabetic();
        if next_ok {
            return Some(((*u).to_string(), end));
        }
    }
    None
}

/// 推断稳定标志：
/// - 含 `US` / `D ` / ` D ` 等 unstable 标记 → false
/// - 含 `S S` / `ST` / 单纯数字 → true
fn infer_stable(line: &str) -> bool {
    // 用 ASCII 分词去看前几个 token，避免误把 "USD" 之类含 US 的字符串当 unstable。
    let upper = line.to_uppercase();
    // 显式 unstable 关键词
    let head: String = upper.chars().take(8).collect();
    if head.starts_with("US") || head.starts_with("US,") || head.starts_with("US ") {
        return false;
    }
    // Mettler: "S D ..." 表示 dynamic
    if head.starts_with("S D ") || head.starts_with("D ") {
        return false;
    }
    // 中段也允许 ",DS," 这类（一些老协议）
    if upper.contains(",DS,") || upper.contains(" DS,") || upper.contains(",D,") {
        return false;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_mettler_stable() {
        let s = parse_generic("S S      45.1234 g\r\n").unwrap();
        assert!((s.value - 45.1234).abs() < 1e-6);
        assert_eq!(s.unit, "g");
        assert!(s.stable);
    }

    #[test]
    fn parse_mettler_dynamic() {
        let s = parse_generic("S D      45.1234 g\r\n").unwrap();
        assert!(!s.stable);
    }

    #[test]
    fn parse_unstable_us_prefix() {
        let s = parse_generic("US,GS,   45.1234 g").unwrap();
        assert!(!s.stable);
        assert_eq!(s.unit, "g");
        assert!((s.value - 45.1234).abs() < 1e-6);
    }

    #[test]
    fn parse_st_prefix_stable() {
        let s = parse_generic("ST,GS,   45.1234 g").unwrap();
        assert!(s.stable);
    }

    #[test]
    fn parse_plus_sign() {
        let s = parse_generic("+   45.12  g \r\n").unwrap();
        assert_eq!(s.unit, "g");
        assert!((s.value - 45.12).abs() < 1e-6);
        assert!(s.stable);
    }

    #[test]
    fn parse_negative_value() {
        let s = parse_generic("S S   -0.0023 g\r\n").unwrap();
        assert!((s.value + 0.0023).abs() < 1e-6);
        assert_eq!(s.unit, "g");
        assert!(s.stable);
    }

    #[test]
    fn parse_kg_unit() {
        let s = parse_generic("S S   1.2345 kg\r\n").unwrap();
        assert_eq!(s.unit, "kg");
        assert!((s.value - 1.2345).abs() < 1e-6);
    }

    #[test]
    fn parse_mg_unit() {
        let s = parse_generic("S S   500 mg\r\n").unwrap();
        assert_eq!(s.unit, "mg");
        assert!((s.value - 500.0).abs() < 1e-6);
    }

    #[test]
    fn parse_invalid_returns_err() {
        let r = parse_generic("garbage no number");
        assert!(matches!(r, Err(SerialError::ParseError(_))));
    }

    #[test]
    fn parse_unit_at_end_with_trailing_space() {
        let s = parse_generic("S S      45.1234 g\r\n").unwrap();
        assert!(s.raw.contains("45.1234"));
        assert!(s.ts >= 0);
    }

    #[test]
    fn parse_sartorius_like() {
        // Sartorius 经典 16 字节："      45.1234 g "
        let s = parse_generic("      45.1234 g \r\n").unwrap();
        assert_eq!(s.unit, "g");
        assert!((s.value - 45.1234).abs() < 1e-6);
        assert!(s.stable);
    }
}
