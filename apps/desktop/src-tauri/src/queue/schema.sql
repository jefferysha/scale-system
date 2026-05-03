CREATE TABLE IF NOT EXISTS pending_records (
  client_uid     TEXT PRIMARY KEY,
  payload        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  attempt_count  INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pending_status ON pending_records(status);
