PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','draft','suspended')),
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json))
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  UNIQUE(id, restaurant_id)
);
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  category_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL CHECK(price_minor >= 0 AND price_minor <= 999999999),
  image_url TEXT,
  is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)),
  is_popular INTEGER NOT NULL DEFAULT 0 CHECK(is_popular IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id, restaurant_id) REFERENCES categories(id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS categories_restaurant ON categories(restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS items_restaurant ON menu_items(restaurant_id, deleted_at, is_available, sort_order);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
