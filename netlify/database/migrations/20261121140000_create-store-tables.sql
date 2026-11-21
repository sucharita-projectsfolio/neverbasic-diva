-- Store schema (ported from the original D1 schema).
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE ebooks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',
  highlights TEXT DEFAULT '[]',
  category TEXT DEFAULT 'Mindset',
  pages INTEGER DEFAULT 0,
  price INTEGER DEFAULT 0,
  mrp INTEGER DEFAULT 0,
  cover TEXT DEFAULT '',
  file_key TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  featured INTEGER DEFAULT 0,
  badge TEXT DEFAULT '',
  sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  kind TEXT DEFAULT 'ebook',
  ebook_id TEXT DEFAULT '',
  item_title TEXT DEFAULT '',
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  payment_mode TEXT DEFAULT 'payu',
  utr TEXT DEFAULT '',
  payu_txnid TEXT DEFAULT '',
  payu_mode TEXT DEFAULT '',
  download_token TEXT DEFAULT '',
  downloads INTEGER DEFAULT 0,
  reseller_code TEXT DEFAULT '',
  meta TEXT DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  paid_at TEXT DEFAULT ''
);
CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_ref TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  order_ref TEXT DEFAULT '',
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_ref TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  message TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  order_ref TEXT NOT NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'requested',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  resolved_at TEXT DEFAULT ''
);
CREATE TABLE resellers (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  order_ref TEXT DEFAULT '',
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  instagram TEXT DEFAULT '',
  code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  starts_at TEXT DEFAULT '',
  expires_at TEXT DEFAULT '',
  clicks INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  handle TEXT DEFAULT '',
  body TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active',
  sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE visits (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (day, path)
);
CREATE INDEX idx_orders_ref ON orders(ref);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_events_ref ON order_events(order_ref);
CREATE INDEX idx_ticket_messages ON ticket_messages(ticket_ref);
