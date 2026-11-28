ALTER TABLE auth_sessions ADD COLUMN reauthenticated_at INTEGER;
CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count>=1), expires_at INTEGER NOT NULL
);
CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(expires_at);
CREATE INDEX auth_sessions_idle ON auth_sessions(idle_expires_at);
-- Protect the last enabled owner even from a future dashboard implementation.
CREATE TRIGGER protect_last_platform_admin BEFORE DELETE ON platform_admins
WHEN EXISTS(SELECT 1 FROM users u JOIN login_credentials c ON c.user_id=u.id WHERE u.id=OLD.user_id AND u.disabled=0 AND c.disabled=0)
AND NOT EXISTS(SELECT 1 FROM platform_admins a JOIN users u ON u.id=a.user_id JOIN login_credentials c ON c.user_id=u.id WHERE a.user_id<>OLD.user_id AND u.disabled=0 AND c.disabled=0)
BEGIN SELECT RAISE(ABORT,'Cannot remove the last enabled platform admin'); END;
CREATE TRIGGER protect_last_admin_user BEFORE UPDATE OF disabled ON users
WHEN NEW.disabled=1 AND OLD.disabled=0 AND EXISTS(SELECT 1 FROM platform_admins WHERE user_id=OLD.id)
AND NOT EXISTS(SELECT 1 FROM platform_admins a JOIN users u ON u.id=a.user_id JOIN login_credentials c ON c.user_id=u.id WHERE a.user_id<>OLD.id AND u.disabled=0 AND c.disabled=0)
BEGIN SELECT RAISE(ABORT,'Cannot disable the last enabled platform admin'); END;
CREATE TRIGGER protect_last_admin_credential BEFORE UPDATE OF disabled ON login_credentials
WHEN NEW.disabled=1 AND OLD.disabled=0 AND EXISTS(SELECT 1 FROM platform_admins WHERE user_id=OLD.user_id)
AND NOT EXISTS(SELECT 1 FROM platform_admins a JOIN users u ON u.id=a.user_id JOIN login_credentials c ON c.user_id=u.id WHERE a.user_id<>OLD.user_id AND u.disabled=0 AND c.disabled=0)
BEGIN SELECT RAISE(ABORT,'Cannot disable the last enabled platform admin'); END;
CREATE TRIGGER protect_last_admin_credential_delete BEFORE DELETE ON login_credentials
WHEN EXISTS(SELECT 1 FROM platform_admins WHERE user_id=OLD.user_id)
AND NOT EXISTS(SELECT 1 FROM platform_admins a JOIN users u ON u.id=a.user_id JOIN login_credentials c ON c.user_id=u.id WHERE a.user_id<>OLD.user_id AND u.disabled=0 AND c.disabled=0)
BEGIN SELECT RAISE(ABORT,'Cannot delete the last platform admin credential'); END;
