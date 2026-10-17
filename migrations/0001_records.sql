CREATE TABLE records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prescription_date TEXT NOT NULL,
  clinic TEXT NOT NULL DEFAULT '',
  pharmacy TEXT NOT NULL DEFAULT '',
  medicines TEXT NOT NULL,
  original_text TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX records_user_date ON records(user_id, prescription_date DESC);
