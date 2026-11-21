-- Growth, AI and feature-layer tables. Additive only: nothing here touches
-- existing rows, so an already-live store keeps every ebook, order and setting.
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT DEFAULT 'percent',
  value INTEGER DEFAULT 0,
  min_amount INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  expires_at TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bundles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  ebook_ids TEXT DEFAULT '[]',
  price INTEGER DEFAULT 0,
  mrp INTEGER DEFAULT 0,
  badge TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  body TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  published_at TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'footer',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  ebook_id TEXT NOT NULL,
  order_ref TEXT DEFAULT '',
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  body TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT DEFAULT '',
  action TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS ai_meta TEXT DEFAULT '{}';
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS sample TEXT DEFAULT '';
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_reviews_ebook ON reviews(ebook_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
