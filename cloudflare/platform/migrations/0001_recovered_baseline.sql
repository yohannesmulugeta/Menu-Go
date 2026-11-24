CREATE TABLE analytics_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 event_type TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 actor_user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
 old_data TEXT CHECK(old_data IS NULL OR json_valid(old_data)), new_data TEXT CHECK(new_data IS NULL OR json_valid(new_data)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TEXT, UNIQUE(id,restaurant_id)
);

CREATE TABLE feedback (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 3000), rating INTEGER CHECK(rating BETWEEN 1 AND 5),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','resolved')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE manager_auth_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE manager_credentials (
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

CREATE TABLE manager_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES manager_credentials(user_id),
 password_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), category_id TEXT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200), description TEXT,
 price REAL NOT NULL CHECK(price>=0 AND price<=9999999.99), image_url TEXT,
 is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)),
 is_popular INTEGER NOT NULL DEFAULT 0 CHECK(is_popular IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT,
 FOREIGN KEY(category_id,restaurant_id) REFERENCES categories(id,restaurant_id)
);

CREATE TABLE opening_hours (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), opens_at TEXT, closes_at TEXT,
 is_closed INTEGER NOT NULL DEFAULT 0 CHECK(is_closed IN (0,1)), UNIQUE(restaurant_id,weekday)
);

CREATE TABLE platform_admins (
 user_id TEXT PRIMARY KEY REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public_request_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE restaurant_invites (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), code_hash TEXT NOT NULL UNIQUE, claim_id TEXT,
 role TEXT NOT NULL DEFAULT 'manager', expires_at TEXT NOT NULL, used_at TEXT,
 created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 invitee_email TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE restaurant_members (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role='manager'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(restaurant_id,user_id)
);

CREATE TABLE restaurants (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 tagline TEXT, description TEXT, phone TEXT, address TEXT, google_maps_url TEXT,
 google_review_url TEXT, instagram_url TEXT, tiktok_url TEXT, cover_image_url TEXT,
 logo_url TEXT, currency TEXT NOT NULL DEFAULT 'ETB', timezone TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('active','draft','suspended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 facebook_url TEXT, youtube_url TEXT, telegram_url TEXT, whatsapp_url TEXT, linkedin_url TEXT, website_url TEXT
);

CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 email_confirmed_at TEXT, disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1))
);

CREATE TABLE wifi_details (
 restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id), network_name TEXT,
 password_hint TEXT, is_visible INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_restaurant ON analytics_events(restaurant_id,event_type);

CREATE INDEX idx_audit_restaurant ON audit_logs(restaurant_id,created_at DESC);

CREATE INDEX idx_categories_restaurant ON categories(restaurant_id,deleted_at,is_active,sort_order);

CREATE INDEX idx_feedback_restaurant ON feedback(restaurant_id,created_at DESC);

CREATE INDEX idx_invites_email ON restaurant_invites(invitee_email,expires_at);

CREATE INDEX idx_items_restaurant ON menu_items(restaurant_id,deleted_at,is_available,sort_order);

CREATE INDEX idx_members_user ON restaurant_members(user_id,restaurant_id);

CREATE INDEX idx_public_request_expiry ON public_request_limits(expires_at);

CREATE INDEX manager_sessions_expiry ON manager_sessions(expires_at);

CREATE INDEX manager_sessions_user ON manager_sessions(user_id);
