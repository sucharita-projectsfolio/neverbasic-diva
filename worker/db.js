// Database schema, default settings and first-run seed content.
import { hashPassword, hex } from "./util.js";

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
  created_at TEXT NOT NULL,
  paid_at TEXT DEFAULT ''
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
CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(ref);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_events_ref ON order_events(order_ref);
CREATE INDEX IF NOT EXISTS idx_ticket_messages ON ticket_messages(ticket_ref);
`;

export const DEFAULT_SETTINGS = {
  brand_name: "Neverbasic Diva",
  brand_tagline: "The knowledge nobody hands you for free.",
  instagram: "neverbasic_diva",
  support_email: "hello@neverbasicdiva.com",
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
    "Scan the UPI QR or open the payment link, pay the exact amount, then paste the UTR / reference number below. Access unlocks the moment it is verified.",
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
};

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

  const existing = await db.prepare("SELECT COUNT(*) AS n FROM settings").first();
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
