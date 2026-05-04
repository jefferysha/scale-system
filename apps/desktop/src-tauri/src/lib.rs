//! Scale Desktop · Tauri 桥接层
//!
//! 仅做 OS 桥接（本地队列、安全存储）。业务逻辑放前端 React。
//! 串口由后端 FastAPI 持有，桌面端复用前端 WebSocketSerialAdapter 通过 WS 订阅。

mod commands;
mod queue;

use commands::queue::QueueState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(QueueState::default())
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::queue::queue_enqueue,
            commands::queue::queue_drain,
            commands::queue::queue_mark_synced,
            commands::queue::queue_mark_failed,
            commands::queue::queue_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_pong() {
        assert_eq!(ping(), "pong");
    }
}
