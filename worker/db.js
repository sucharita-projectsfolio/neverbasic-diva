// Database schema, default settings and first-run seed content.
import { hashPassword, hex } from "./util.js";
import { DEFAULT_RATES } from "./currency.js";
import { PROVIDER_CATALOG, RETIRED_MODELS } from "./ai.js";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ebooks (
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
CREATE TABLE IF NOT EXISTS orders (
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
  currency TEXT DEFAULT 'INR',
  amount_charged REAL DEFAULT 0,
  country TEXT DEFAULT '',
  gateway_order_id TEXT DEFAULT '',
  customer_id TEXT DEFAULT '',
  email_sent_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  paid_at TEXT DEFAULT ''
);
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
CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_ref TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
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
CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_ref TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
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
CREATE TABLE IF NOT EXISTS refunds (
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
CREATE TABLE IF NOT EXISTS resellers (
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
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  handle TEXT DEFAULT '',
  body TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active',
  sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (day, path)
);
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
  source TEXT DEFAULT 'customer',
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
CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(ref);
CREATE INDEX IF NOT EXISTS idx_reviews_ebook ON reviews(ebook_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_events_ref ON order_events(order_ref);
CREATE INDEX IF NOT EXISTS idx_ticket_messages ON ticket_messages(ticket_ref);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_sessions ON customer_sessions(customer_id);
`;

export const DEFAULT_SETTINGS = {
  brand_name: "Neverbasic Diva",
  brand_tagline: "The knowledge nobody hands you for free.",
  instagram: "neverbasic_diva",
  support_email: "connectgridx@gmail.com",
  telegram: "Nadia_valentina9",
  telegram_note: "Fastest replies. Open the chat and your message is already written — just hit send.",
  whatsapp: "",
  announcement: "Instant PDF delivery after payment · Resell rights open for a limited time · 100% refund if it doesn't land",
  hero_eyebrow: "micro-ebooks for women who refuse to stay basic",
  hero_title: "The rules they never taught you.",
  hero_sub: "Sharp, honest, uncomfortably useful ebooks on money, people and self-worth. Priced like a cup of chai — built to change how you move for years.",
  hero_note: "Every ebook is delivered the second your payment clears. No email chasing, no waiting list.",
  accent_color: "#B0665A",
  ink_color: "#241E1B",
  bg_color: "#FAF6F0",
  payu_enabled: "0",
  payu_key: "",
  payu_salt: "",
  payu_mode: "test",
  payment_link: "",
  upi_id: "",
  pay_instructions:
    "Pay the exact amount shown on this page. Your download unlocks the second the gateway confirms the payment — no screenshots, no UTR numbers.",
  resell_price: "399",
  resell_enabled: "1",
  resell_commission_note: "You keep 100% of what you charge your buyers. Our ₹399 is a one-time, one-year licence fee.",
  refund_window_days: "3",
  refund_policy:
    "If an ebook does not land for you, ask and we will make it right — first by sending material matched to what you actually wanted, then by a 100% refund if it still isn't it. Requests are opened within 3 days of purchase.",
  terms:
    "All ebooks are original work by Neverbasic Diva. A purchase grants you a personal, single-user licence to read and apply the material. Files are watermarked to your order. Sharing, uploading or reselling without a resell licence is a breach of this licence.",
  license_terms:
    "Personal licence: read, re-read, apply. You may quote short excerpts with credit. You may not resell, bundle, translate or distribute the file. Resell licence (₹399 / one year): you may sell the ebooks to your own audience and keep the revenue, but you may not claim authorship, alter the brand, or share the source files publicly.",
  privacy:
    "We store only what an order needs: your name, email, phone, order reference and payment status. Your data is never sold. Payment details are handled entirely by PayU — we never see or store your card, UPI PIN or bank credentials.",
  about:
    "Neverbasic Diva is a small, deliberately sharp library for women who want the unspoken version. No fluff, no 300-page padding — just the frameworks that actually move money, rooms and self-respect.",
  faqs: JSON.stringify([
    {
      q: "How do I get the ebook after paying?",
      a: "Your download unlocks automatically on the order page the moment payment is confirmed. Save the page — the link stays live on your order reference.",
    },
    {
      q: "The price is less than my coffee. Is it real?",
      a: "Yes. The price is deliberately low so the knowledge travels. The value is in what you do with it, not in what it costs.",
    },
    {
      q: "Can I resell these ebooks?",
      a: "Only with a resell licence — one-time ₹399 for one full year. It lets you sell the ebooks to your audience and keep the money. Without it, reselling is not permitted.",
    },
    {
      q: "What if I don't like it?",
      a: "Tell us what you actually needed. We send material matched to that. If it still doesn't work for you, we refund 100%.",
    },
    {
      q: "Is my payment safe?",
      a: "Payments run through PayU's secure checkout. We never store card or UPI credentials on this site.",
    },
  ]),
  stats: JSON.stringify([
    { value: "12,400+", label: "readers" },
    { value: "4.9/5", label: "reader rating" },
    { value: "2 min", label: "average read" },
    { value: "100%", label: "refund honour" },
  ]),
  // Store builder: ordered home-page sections, global copy overrides and look settings.
  // They are JSON blobs edited only from the admin design studio; the storefront
  // merges them over its built-in defaults (see src/lib/sitekit.jsx).
  site_blocks: "[]",
  site_content: "{}",
  site_theme: "{}",

  // AI copy studio. Keys can live here (pasted in admin) or in GROQ_API_KEY /
  // OPENROUTER_API_KEY environment variables on Netlify / Cloudflare.
  ai_enabled: "1",
  ai_tone: "sharp, warm, human and specific — direct-response copy without fake claims",
  ai_config:
    '{"temperature":0.85,"providers":[{"id":"gemini","enabled":true,"apiKey":"","models":["gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite"]},{"id":"groq","enabled":true,"apiKey":"","models":["openai/gpt-oss-120b","qwen/qwen3.8-27b","openai/gpt-oss-20b","openai/gpt-oss-safeguard-20b"]},{"id":"openrouter","enabled":true,"apiKey":"","models":["nvidia/nemotron-3-ultra-550b-a55b:free","nvidia/nemotron-3.5-lightning:free","recursive/flint-v1.0:free","baidu/ernie-5.5-flash-preview:free","particle-ai/particle-1:free","inclusionai/ling-3.2-flash:free"]}]}',

  // Storefront feature switches (JSON, edited in Studio → Growth).
  store_features:
    '{"search":true,"wishlist":true,"recent":true,"coupons":true,"bundles":true,"samples":true,"reviews":true,"journal":true,"newsletter":true,"assistant":true,"whatsappFloat":true,"socialProof":true,"exitIntent":true,"countdown":true,"share":true,"receipts":true,"stickyBuy":true,"trustBadges":true,"upsell":true,"orderTrack":true}',

  // Payment gateways — every key is set from Admin → Payments, never from code.
  payment_gateway: "auto",
  currency: "INR",
  currency_symbol: "₹",
  // Country-aware pricing: prices are stored in INR and converted for the
  // buyer's country. Rates are "1 unit = X INR" and editable in admin.
  currency_auto: "1",
  currency_rates: JSON.stringify(DEFAULT_RATES),
  paypal_enabled: "0",
  paypal_client_id: "",
  paypal_client_secret: "",
  paypal_mode: "sandbox",
  paypal_webhook_id: "",
  // Delivery email (Resend). Without a key the order still unlocks and the
  // buyer downloads from the order page.
  resend_api_key: "",
  mail_from: "",
  email_receipts: "1",
  // Customer accounts. Email + password works out of the box; adding a Firebase
  // web API key also enables Firebase email/password sign-in.
  customer_accounts: "1",
  firebase_api_key: "",
  firebase_project_id: "",
  site_url: "",
  razorpay_enabled: "0",
  razorpay_key_id: "",
  razorpay_key_secret: "",
  stripe_enabled: "0",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  gateway_note: "",
  newsletter_heading: "One letter. One useful idea. No noise.",
  newsletter_note: "Get new ebooks and the unspoken notes before they go public. Unsubscribe in one click.",
  whatsapp_note: "Questions before you buy? Message us — a human replies.",
  exit_offer_heading: "Before you go — take 10% off",
  exit_offer_note: "Use this code at checkout. It works once, and only for a while.",
  exit_coupon_code: "",
};

// Columns added after the first release. SQLite has no ADD COLUMN IF NOT EXISTS,
// so every statement is applied inside a try/catch in init(). Postgres uses the
// migration file in netlify/database/migrations instead.
export const MIGRATION_ALTERS = [
  "ALTER TABLE ebooks ADD COLUMN ai_meta TEXT DEFAULT '{}'",
  "ALTER TABLE ebooks ADD COLUMN sample TEXT DEFAULT ''",
  "ALTER TABLE ebooks ADD COLUMN tags TEXT DEFAULT '[]'",
  "ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'INR'",
  "ALTER TABLE orders ADD COLUMN amount_charged REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN country TEXT DEFAULT ''",
  "ALTER TABLE orders ADD COLUMN gateway_order_id TEXT DEFAULT ''",
  "ALTER TABLE orders ADD COLUMN customer_id TEXT DEFAULT ''",
  "ALTER TABLE orders ADD COLUMN email_sent_at TEXT DEFAULT ''",
  "ALTER TABLE reviews ADD COLUMN source TEXT DEFAULT 'customer'",
  "CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT DEFAULT '', email TEXT NOT NULL UNIQUE, phone TEXT DEFAULT '', country TEXT DEFAULT '', pass_hash TEXT DEFAULT '', salt TEXT DEFAULT '', firebase_uid TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT NOT NULL, last_login_at TEXT DEFAULT '')",
  "CREATE TABLE IF NOT EXISTS customer_sessions (token TEXT PRIMARY KEY, customer_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)",
  "CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)",
  // The old copy told buyers to paste a UTR. Gateway payments never need that.
  "UPDATE settings SET value = 'Pay the exact amount shown on this page. Your download unlocks the second the gateway confirms the payment — no screenshots, no UTR numbers.' WHERE key = 'pay_instructions' AND value LIKE 'Scan the UPI QR%'",
  // The store's real support channels. An install that still carries the old
  // placeholder address (or nothing) gets the live one; a deliberately changed
  // address is left alone.
  "UPDATE settings SET value = 'connectgridx@gmail.com' WHERE key = 'support_email' AND (value = '' OR value = 'hello@neverbasicdiva.com')",
  "INSERT INTO settings (key, value) SELECT 'telegram', 'Nadia_valentina9' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'telegram')",
  "INSERT INTO settings (key, value) SELECT 'telegram_note', 'Fastest replies. Open the chat and your message is already written — just hit send.' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'telegram_note')",
];

const SEED_EBOOKS = [
  {
    title: "The Unspoken Money Rules",
    subtitle: "What quietly wealthy women do differently with money",
    category: "Money",
    price: 99,
    mrp: 499,
    badge: "Bestseller",
    featured: 1,
    pages: 34,
    cover: "/covers/cover-1.jpg",
    highlights: [
      "The 3-account system that makes saving feel effortless",
      "Why your salary is not your income — and what to do this month",
      "The exact sentences to use when negotiating money without apologising",
      "How to price yourself when nobody has told you your number",
    ],
    description:
      "Money is not a maths problem for most women — it is a permission problem. This ebook removes the permission gap. Inside: the account structure that survives real life, the negotiation scripts that don't sound aggressive, and the quiet compounding habits nobody posts about.",
  },
  {
    title: "Soft Power",
    subtitle: "Reading rooms, people and unspoken hierarchy",
    category: "People",
    price: 149,
    mrp: 599,
    badge: "Reader favourite",
    featured: 1,
    pages: 42,
    cover: "/covers/cover-2.jpg",
    highlights: [
      "The 10-second read that tells you who actually holds power in a room",
      "How to be taken seriously without becoming hard",
      "Boundary lines that keep respect instead of costing it",
      "The art of the graceful exit — from conversations, jobs and dynamics",
    ],
    description:
      "Charm is a skill, not a personality. Soft Power breaks down social intelligence into moves you can practise: how attention actually flows, how to ask for things so a yes is easier than a no, and how to leave a room with more status than you entered it with.",
  },
  {
    title: "The Quiet Mind Protocol",
    subtitle: "Focus, calm and self-trust in a loud world",
    category: "Mind",
    price: 99,
    mrp: 399,
    badge: "New",
    featured: 1,
    pages: 28,
    cover: "/covers/cover-3.jpg",
    highlights: [
      "The 12-minute reset that replaces doom-scrolling",
      "Why discipline fails when your nervous system is dysregulated",
      "A shutdown ritual that ends work guilt at 7pm",
      "How to trust your own decisions again after being talked over",
    ],
    description:
      "You do not need more motivation. You need a nervous system that isn't firefighting. This is the small, unglamorous protocol: what to do in the first ten minutes of the day, how to recover after a spiral, and the one question that ends overthinking.",
  },
  {
    title: "Digital Leverage",
    subtitle: "Turning taste, notes and a phone into income",
    category: "Leverage",
    price: 199,
    mrp: 799,
    badge: "High value",
    featured: 1,
    pages: 48,
    cover: "/covers/cover-4.jpg",
    highlights: [
      "The one-page offer that sells without a big following",
      "How to repurpose one idea into 30 pieces of content",
      "Pricing psychology for digital products under ₹500",
      "A 7-day launch plan that works with a full-time job",
    ],
    description:
      "You do not need 100k followers. You need one clear offer and a system that keeps it visible. Digital Leverage is the practical build: what to sell first, how to package it, the content rhythm that doesn't burn you out, and the numbers to watch instead of likes.",
  },
];

const SEED_TESTIMONIALS = [
  {
    name: "Ananya",
    handle: "@ananya.reads",
    body: "I asked for better material on negotiating my salary and got a response the same evening. The ebook paid for itself in one conversation.",
    rating: 5,
  },
  {
    name: "Ritika",
    handle: "@ritikabuilds",
    body: "₹99 for something I've re-read four times. Soft Power completely changed how I handle meetings.",
    rating: 5,
  },
  {
    name: "Sana",
    handle: "@sanadiaries",
    body: "Bought the resell licence for ₹399, put it on my stories, made it back in two days. The licence process was genuinely simple.",
    rating: 5,
  },
  {
    name: "Meher",
    handle: "@meher.mind",
    body: "The Quiet Mind Protocol is the only thing that got me off my phone at night. Small but stupidly useful.",
    rating: 5,
  },
];

let readyPromise = null;

export function ensureReady(env) {
  if (!readyPromise) readyPromise = init(env).catch((error) => { readyPromise = null; throw error; });
  return readyPromise;
}

async function init(env) {
  const db = env.DB;
  // On Netlify the schema is applied by database migrations, so DDL only runs on D1.
  if (!db.schemaManaged) {
    // D1 splits exec() input on newlines, so run the DDL as a batch of prepared statements.
    const ddl = SCHEMA.split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => db.prepare(statement));
    await db.batch(ddl);
  }

  if (MIGRATION_ALTERS.length) {
    for (const statement of MIGRATION_ALTERS) {
      try {
        await db.prepare(statement).run();
      } catch {
        // Column already exists — normal on every boot after the first one.
      }
    }
  }

  const existing = await db.prepare("SELECT COUNT(*) AS n FROM settings").first();
  if (existing && existing.n) {
    // New settings keys ship with later releases; add any missing ones without
    // touching values the admin has already saved.
    const existingKeys = await db.prepare("SELECT key FROM settings").all();
    const known = new Set((existingKeys.results || []).map((row) => row.key));
    const missing = Object.entries(DEFAULT_SETTINGS).filter(([key]) => !known.has(key));
    if (missing.length) {
      await db.batch(
        missing.map(([key, value]) =>
          db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING").bind(key, String(value))
        )
      );
    }
  }
  if (!existing || !existing.n) {
    const statements = Object.entries(DEFAULT_SETTINGS).map(([key, value]) =>
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING").bind(key, String(value))
    );
    await db.batch(statements);
  }

  const ebooks = await db.prepare("SELECT COUNT(*) AS n FROM ebooks").first();
  if (!ebooks || !ebooks.n) {
    const now = new Date().toISOString();
    const rows = SEED_EBOOKS.map((ebook, index) =>
      db
        .prepare(
          `INSERT INTO ebooks (id, slug, title, subtitle, description, highlights, category, pages, price, mrp, cover, file_key, file_name, file_size, status, featured, badge, sort, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
        )
        .bind(
          hex(8),
          ["unspoken-money-rules", "soft-power", "quiet-mind-protocol", "digital-leverage"][index],
          ebook.title,
          ebook.subtitle,
          ebook.description,
          JSON.stringify(ebook.highlights),
          ebook.category,
          ebook.pages,
          ebook.price,
          ebook.mrp,
          ebook.cover,
          `demo:${index + 1}`,
          `${["unspoken-money-rules", "soft-power", "quiet-mind-protocol", "digital-leverage"][index]}.pdf`,
          0,
          ebook.featured,
          ebook.badge,
          index,
          now
        )
    );
    await db.batch(rows);
  }

  const testimonials = await db.prepare("SELECT COUNT(*) AS n FROM testimonials").first();
  if (!testimonials || !testimonials.n) {
    const now = new Date().toISOString();
    await db.batch(
      SEED_TESTIMONIALS.map((t, i) =>
        db
          .prepare(
            "INSERT INTO testimonials (id, name, handle, body, rating, status, sort, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)"
          )
          .bind(hex(8), t.name, t.handle, t.body, t.rating, i, now)
      )
    );
  }

  // Owner credentials from the environment: ADMIN_EMAIL + ADMIN_PASSWORD in
  // .dev.vars locally and in the hosting dashboard for production. The password
  // never lives in the repo. An admin with that email is never rewritten, so a
  // password changed from the panel is not silently reset on the next restart.
  await refreshAiModels(db);

  const ownerEmail = String(env && env.ADMIN_EMAIL ? env.ADMIN_EMAIL : "").trim().toLowerCase();
  const ownerPassword = String(env && env.ADMIN_PASSWORD ? env.ADMIN_PASSWORD : "");
  if (ownerEmail && ownerPassword.length >= 8) {
    const match = await db.prepare("SELECT id FROM admins WHERE LOWER(email) = ?").bind(ownerEmail).first();
    if (!match) await createAdmin(db, ownerEmail, ownerPassword);
  }
}

// Drops retired model ids from a saved AI config and, when nothing usable is
// left, swaps in the current strong catalog. Admin-added live models are kept.
async function refreshAiModels(db) {
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'ai_config'").first();
    if (!row || !row.value) return;
    const parsed = JSON.parse(row.value);
    const providers = Array.isArray(parsed.providers) ? parsed.providers : [];
    let changed = false;
    for (const provider of providers) {
      const meta = PROVIDER_CATALOG[provider.id];
      if (!meta) continue; // custom provider is left exactly as configured
      const saved = (Array.isArray(provider.models) ? provider.models : []).filter((model) => typeof model === "string" && model.trim());
      const alive = saved.filter((model) => !RETIRED_MODELS.has(model));
      if (alive.length === saved.length) continue;
      provider.models = alive.length ? alive : [...meta.models];
      changed = true;
    }
    if (changed) {
      await db.prepare("UPDATE settings SET value = ? WHERE key = 'ai_config'").bind(JSON.stringify(parsed)).run();
    }
  } catch {
    // A bad saved value must never stop the store from booting.
  }
}

export async function getSettings(db, keys = null) {
  if (keys && keys.length) {
    const placeholders = keys.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
      .bind(...keys)
      .all();
    const out = {};
    for (const row of rows.results || []) out[row.key] = row.value;
    return out;
  }
  const rows = await db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  for (const row of rows.results || []) out[row.key] = row.value;
  return out;
}

export async function setSetting(db, key, value) {
  return db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, String(value ?? ""))
    .run();
}

export async function logEvent(db, orderRef, type, message = "") {
  await db
    .prepare("INSERT INTO order_events (id, order_ref, type, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(hex(8), orderRef, type, message, new Date().toISOString())
    .run();
}

export async function createAdmin(db, email, password) {
  const { hash, salt } = await hashPassword(password);
  const id = hex(8);
  await db
    .prepare("INSERT INTO admins (id, email, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, email, hash, salt, new Date().toISOString())
    .run();
  return id;
}
