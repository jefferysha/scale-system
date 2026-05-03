//! 离线队列 Tauri commands。
//!
//! 暴露：
//! - `queue_enqueue(client_uid, payload)`
//! - `queue_drain(max) -> Vec<PendingItem>`
//! - `queue_mark_synced(uids)`
//! - `queue_mark_failed(uid, error)`
//! - `queue_count() -> { pending, needs_review }`

use crate::queue::{PendingItem, Queue};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

const MAX_ATTEMPTS: i64 = 5;

pub struct QueueState(pub Mutex<Option<Queue>>);

impl Default for QueueState {
    fn default() -> Self {
        QueueState(Mutex::new(None))
    }
}

#[derive(Serialize)]
pub struct QueueCount {
    pub pending: i64,
    pub needs_review: i64,
}

fn ensure_queue<'a>(
    app: &AppHandle,
    state: &'a State<QueueState>,
) -> Result<std::sync::MutexGuard<'a, Option<Queue>>, String> {
    let mut guard = state.0.lock().map_err(|_| "queue state poisoned".to_string())?;
    if guard.is_none() {
        let dir: PathBuf = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("cannot resolve app_data_dir: {e}"))?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join("queue.sqlite");
        *guard = Some(Queue::open(path).map_err(|e| e.to_string())?);
    }
    Ok(guard)
}

#[tauri::command]
pub async fn queue_enqueue(
    app: AppHandle,
    state: State<'_, QueueState>,
    client_uid: String,
    payload: String,
) -> Result<(), String> {
    let g = ensure_queue(&app, &state)?;
    g.as_ref()
        .expect("queue init")
        .enqueue(&client_uid, &payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_drain(
    app: AppHandle,
    state: State<'_, QueueState>,
    max: usize,
) -> Result<Vec<PendingItem>, String> {
    let g = ensure_queue(&app, &state)?;
    g.as_ref()
        .expect("queue init")
        .drain(max)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_mark_synced(
    app: AppHandle,
    state: State<'_, QueueState>,
    uids: Vec<String>,
) -> Result<(), String> {
    let g = ensure_queue(&app, &state)?;
    g.as_ref()
        .expect("queue init")
        .mark_synced(&uids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_mark_failed(
    app: AppHandle,
    state: State<'_, QueueState>,
    uid: String,
    error: String,
) -> Result<(), String> {
    let g = ensure_queue(&app, &state)?;
    g.as_ref()
        .expect("queue init")
        .mark_failed(&uid, &error, MAX_ATTEMPTS)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn queue_count(
    app: AppHandle,
    state: State<'_, QueueState>,
) -> Result<QueueCount, String> {
    let g = ensure_queue(&app, &state)?;
    let (pending, needs_review) = g
        .as_ref()
        .expect("queue init")
        .count()
        .map_err(|e| e.to_string())?;
    Ok(QueueCount {
        pending,
        needs_review,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_state_default_empty() {
        let s = QueueState::default();
        assert!(s.0.lock().unwrap().is_none());
    }

    #[test]
    fn queue_count_serializes_snake_case() {
        let c = QueueCount {
            pending: 3,
            needs_review: 1,
        };
        let s = serde_json::to_string(&c).unwrap();
        assert!(s.contains("\"pending\":3"));
        assert!(s.contains("\"needs_review\":1"));
    }
}
