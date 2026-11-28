CREATE UNIQUE INDEX menu_items_id_restaurant ON menu_items(id,restaurant_id);
CREATE TABLE platform_environment (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  name TEXT NOT NULL CHECK(name='admaki-menu-platform-staging')
);
INSERT INTO platform_environment(singleton,name) VALUES(1,'admaki-menu-platform-staging');
CREATE TABLE login_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(username) BETWEEN 3 AND 48),
  hash_format TEXT NOT NULL, password_hash TEXT NOT NULL,
  parameters_json TEXT NOT NULL CHECK(json_valid(parameters_json) AND json_type(parameters_json)='object'),
  credential_version INTEGER NOT NULL DEFAULT 1 CHECK(credential_version>=1),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
  temporary_expires_at INTEGER,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
  user_id TEXT NOT NULL REFERENCES login_credentials(user_id),
  credential_version INTEGER NOT NULL CHECK(credential_version>=1),
  created_at INTEGER NOT NULL, idle_expires_at INTEGER NOT NULL,
  absolute_expires_at INTEGER NOT NULL, revoked_at INTEGER,
  CHECK(idle_expires_at>created_at AND absolute_expires_at>=idle_expires_at)
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id,revoked_at);
CREATE INDEX auth_sessions_expiry ON auth_sessions(absolute_expires_at);
CREATE TABLE template_releases (
  template_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1), name TEXT NOT NULL,
  supported_features_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(supported_features_json) AND json_type(supported_features_json)='array'),
  PRIMARY KEY(template_id,version)
);
CREATE TABLE feature_policies (
  feature_key TEXT PRIMARY KEY,
  allowed INTEGER NOT NULL DEFAULT 1 CHECK(allowed IN (0,1)),
  manager_editable INTEGER NOT NULL DEFAULT 1 CHECK(manager_editable IN (0,1)),
  forced_value INTEGER CHECK(forced_value IS NULL OR forced_value IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1)
);
CREATE TABLE restaurant_configs (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version>=1),
  template_id TEXT NOT NULL, template_version INTEGER NOT NULL,
  features_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(features_json) AND json_type(features_json)='object'),
  theme_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(theme_json) AND json_type(theme_json)='object'),
  content_settings_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(content_settings_json) AND json_type(content_settings_json)='object'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(template_id,template_version) REFERENCES template_releases(template_id,version)
);
CREATE TABLE config_presets (
  preset_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1), name TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version>=1),
  config_json TEXT NOT NULL CHECK(json_valid(config_json) AND json_type(config_json)='object'),
  PRIMARY KEY(preset_id,version)
);
CREATE TABLE restaurant_publications (
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id), revision INTEGER NOT NULL CHECK(revision>=1),
  config_revision INTEGER NOT NULL CHECK(config_revision>=1),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
  created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(restaurant_id,revision)
);
CREATE TABLE restaurant_publication_heads (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id), revision INTEGER NOT NULL,
  FOREIGN KEY(restaurant_id,revision) REFERENCES restaurant_publications(restaurant_id,revision)
);
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), object_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('logo','cover','item')),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  width INTEGER NOT NULL CHECK(width>0), height INTEGER NOT NULL CHECK(height>0),
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=5242880),
  checksum_sha256 TEXT NOT NULL CHECK(length(checksum_sha256)=64),
  state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','retained','deleted')),
  created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(id,restaurant_id)
);
CREATE INDEX media_assets_restaurant ON media_assets(restaurant_id,state,created_at);
CREATE TABLE platform_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT,
  before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)),
  request_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX platform_audit_created ON platform_audit_logs(created_at,id);
CREATE TABLE daily_analytics (
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id), day TEXT NOT NULL CHECK(length(day)=10),
  event_type TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0 CHECK(count>=0),
  PRIMARY KEY(restaurant_id,day,event_type)
);
CREATE TABLE menu_item_variants (
  id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL, menu_item_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 120),
  price_minor INTEGER NOT NULL CHECK(price_minor>=0), sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  FOREIGN KEY(menu_item_id,restaurant_id) REFERENCES menu_items(id,restaurant_id)
);
CREATE INDEX variants_item ON menu_item_variants(restaurant_id,menu_item_id,is_active,sort_order);
CREATE TABLE menu_item_translations (
  restaurant_id TEXT NOT NULL, menu_item_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en','am','om','ti')),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200), description TEXT,
  PRIMARY KEY(restaurant_id,menu_item_id,locale),
  FOREIGN KEY(menu_item_id,restaurant_id) REFERENCES menu_items(id,restaurant_id)
);

