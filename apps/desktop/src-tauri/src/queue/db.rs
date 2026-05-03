//! SQLite 持久化层。所有 `pub fn` 都是 thread-safe（内部 Mutex）。

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingItem {
    pub client_uid: String,
    pub payload: String,
    pub status: String,
    pub attempt_count: i64,
    pub last_error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct Queue {
    conn: Mutex<Connection>,
}

impl Queue {
    /// 打开（不存在则建）一个 SQLite 队列文件。
    pub fn open(path: PathBuf) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 入队。`client_uid` 已存在则忽略（幂等）。
    pub fn enqueue(&self, client_uid: &str, payload: &str) -> rusqlite::Result<()> {
        let now = now_ms();
        let conn = self.conn.lock().expect("queue mutex");
        conn.execute(
            "INSERT OR IGNORE INTO pending_records
                (client_uid, payload, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)",
            params![client_uid, payload, now],
        )?;
        Ok(())
    }

    /// 取一批待同步记录（pending + failed 且 attempt < max）。
    pub fn drain(&self, max: usize) -> rusqlite::Result<Vec<PendingItem>> {
        let conn = self.conn.lock().expect("queue mutex");
        let mut stmt = conn.prepare(
            "SELECT client_uid, payload, status, attempt_count, last_error, created_at, updated_at
             FROM pending_records
             WHERE status IN ('pending','failed') AND attempt_count < 5
             ORDER BY created_at ASC
             LIMIT ?1",
        )?;
        let items = stmt
            .query_map(params![max as i64], |r| {
                Ok(PendingItem {
                    client_uid: r.get(0)?,
                    payload: r.get(1)?,
                    status: r.get(2)?,
                    attempt_count: r.get(3)?,
                    last_error: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(items)
    }

    /// 标记一批为已同步。
    pub fn mark_synced(&self, uids: &[String]) -> rusqlite::Result<()> {
        let conn = self.conn.lock().expect("queue mutex");
        let now = now_ms();
        for uid in uids {
            conn.execute(
                "UPDATE pending_records
                 SET status='synced', updated_at=?2
                 WHERE client_uid=?1",
                params![uid, now],
            )?;
        }
        Ok(())
    }

    /// 标记单条失败。`max_attempts` 达到后转 `needs_review`，停止重试。
    pub fn mark_failed(
        &self,
        uid: &str,
        err: &str,
        max_attempts: i64,
    ) -> rusqlite::Result<()> {
        let conn = self.conn.lock().expect("queue mutex");
        let now = now_ms();
        conn.execute(
            "UPDATE pending_records SET
                 status        = CASE WHEN attempt_count + 1 >= ?3
                                       THEN 'needs_review' ELSE 'failed' END,
                 attempt_count = attempt_count + 1,
                 last_error    = ?2,
                 updated_at    = ?4
             WHERE client_uid = ?1",
            params![uid, err, max_attempts, now],
        )?;
        Ok(())
    }

    /// 给前端用的状态计数。
    pub fn count(&self) -> rusqlite::Result<(i64, i64)> {
        let conn = self.conn.lock().expect("queue mutex");
        let pending: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_records
             WHERE status IN ('pending','failed')",
            [],
            |r| r.get(0),
        )?;
        let needs_review: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_records WHERE status='needs_review'",
            [],
            |r| r.get(0),
        )?;
        Ok((pending, needs_review))
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use uuid::Uuid;

    fn tmp_path() -> PathBuf {
        temp_dir().join(format!("scale-queue-test-{}.sqlite", Uuid::new_v4()))
    }

    #[test]
    fn enqueue_then_drain_returns_items() {
        let q = Queue::open(tmp_path()).unwrap();
        q.enqueue("u1", r#"{"a":1}"#).unwrap();
        q.enqueue("u2", r#"{"a":2}"#).unwrap();
        let items = q.drain(10).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].client_uid, "u1");
    }

    #[test]
    fn enqueue_is_idempotent_on_duplicate_uid() {
        let q = Queue::open(tmp_path()).unwrap();
        q.enqueue("u1", "{}").unwrap();
        q.enqueue("u1", "{}").unwrap();
        let items = q.drain(10).unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn mark_synced_removes_from_drain() {
        let q = Queue::open(tmp_path()).unwrap();
        q.enqueue("u1", "{}").unwrap();
        q.mark_synced(&["u1".into()]).unwrap();
        let items = q.drain(10).unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn mark_failed_increments_attempt_and_keeps_failed() {
        let q = Queue::open(tmp_path()).unwrap();
        q.enqueue("u1", "{}").unwrap();
        q.mark_failed("u1", "boom", 5).unwrap();
        let items = q.drain(10).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].attempt_count, 1);
        assert_eq!(items[0].status, "failed");
        assert_eq!(items[0].last_error.as_deref(), Some("boom"));
    }

    #[test]
    fn mark_failed_at_max_goes_needs_review() {
        let q = Queue::open(tmp_path()).unwrap();
        q.enqueue("u1", "{}").unwrap();
        for _ in 0..5 {
            q.mark_failed("u1", "boom", 5).unwrap();
        }
        let items = q.drain(10).unwrap();
        assert!(items.is_empty(), "needs_review 不应再被 drain");
        let (pending, needs_review) = q.count().unwrap();
        assert_eq!(pending, 0);
        assert_eq!(needs_review, 1);
    }

    #[test]
    fn count_separates_pending_and_needs_review() {
        let q = Queue::open(tmp_path()).unwrap();
        q.enqueue("u1", "{}").unwrap();
        q.enqueue("u2", "{}").unwrap();
        for _ in 0..5 {
            q.mark_failed("u2", "x", 5).unwrap();
        }
        let (pending, needs_review) = q.count().unwrap();
        assert_eq!(pending, 1);
        assert_eq!(needs_review, 1);
    }

    #[test]
    fn drain_respects_limit() {
        let q = Queue::open(tmp_path()).unwrap();
        for i in 0..10 {
            q.enqueue(&format!("u{i}"), "{}").unwrap();
        }
        let items = q.drain(3).unwrap();
        assert_eq!(items.len(), 3);
    }
}
