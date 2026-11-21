-- Additive migration for PayPal checkout, country-aware currency, delivery
-- email and customer accounts. Safe to run on a live store: existing orders,
-- ebooks and settings are untouched.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_charged DOUBLE PRECISION DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_order_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  country TEXT DEFAULT '',
  pass_hash TEXT DEFAULT '',
  salt TEXT DEFAULT '',
  firebase_uid TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_login_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_sessions ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
