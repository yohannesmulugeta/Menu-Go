CREATE TABLE IF NOT EXISTS manager_credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL,
 iterations INTEGER NOT NULL DEFAULT 100000,
 password_version INTEGER NOT NULL DEFAULT 1,
 must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS manager_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES manager_credentials(user_id),
 password_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS manager_sessions_user ON manager_sessions(user_id);
CREATE INDEX IF NOT EXISTS manager_sessions_expiry ON manager_sessions(expires_at);
CREATE TABLE IF NOT EXISTS manager_auth_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
