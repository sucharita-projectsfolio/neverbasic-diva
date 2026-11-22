// Growth + AI feature APIs: coupons, bundles, newsletter, verified reviews, journal,
// AI copy studio, security sessions, audit log and backups. Mounted by worker/index.js
// so the main router stays readable.
import { getSettings } from "./db.js";
import * as U from "./util.js";
import {
  aiStatus,
  readAiConfig,
  analyzeEbook,
  generateReviews,
  generateSection,
  generateStore,
  rewriteBlock,
  assistantReply,
  fallbackReply,
  testAi,
  pdfToText,
} from "./ai.js";
import { gatewayState, testGateways } from "./payments.js";

export const DEFAULT_FEATURES = {
  search: true,
  wishlist: true,
  recent: true,
  coupons: true,
  bundles: true,
  samples: true,
  reviews: true,
  journal: true,
  newsletter: true,
  assistant: true,
  whatsappFloat: true,
  socialProof: true,
  exitIntent: true,
  countdown: true,
  share: true,
  receipts: true,
  stickyBuy: true,
  trustBadges: true,
  upsell: true,
  orderTrack: true,
  orderBump: true,
  bundleUpsell: true,
};

export function readFeatures(settings = {}) {
  try {
    const parsed = JSON.parse(settings.store_features || "{}");
    return { ...DEFAULT_FEATURES, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

const json = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

/* ------------------------------- rate limits ------------------------------ */

const bucket = new Map();

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const record = bucket.get(key);
  if (!record || now - record.at > windowMs) {
    bucket.set(key, { count: 1, at: now });
    return true;
  }
  record.count += 1;
  if (bucket.size > 4000) {
    for (const [entry, value] of bucket) if (now - value.at > windowMs * 2) bucket.delete(entry);
  }
  return record.count <= max;
}

const ipOf = (request) =>
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("x-nf-client-connection-ip") ||
  (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  "local";

/* --------------------------------- audit --------------------------------- */

export async function audit(db, admin, action, detail = "", request = null) {
  try {
    await db
      .prepare("INSERT INTO audit_log (id, actor, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(U.hex(8), admin ? admin.email || "admin" : "system", action, String(detail).slice(0, 500), request ? ipOf(request) : "", new Date().toISOString())
      .run();
  } catch {
    /* audit must never break an action */
  }
}

/* -------------------------------- coupons -------------------------------- */

export function normaliseCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

export async function validateCoupon(db, settings, { code, amount }) {
  const clean = normaliseCode(code);
  if (!clean) return { ok: false, error: "Enter a code." };
  const row = await db.prepare("SELECT * FROM coupons WHERE UPPER(code) = ?").bind(clean).first();
  if (!row || row.status !== "active") return { ok: false, error: "That code is not valid." };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That code has expired." };
  }
  if (Number(row.max_uses) > 0 && Number(row.used) >= Number(row.max_uses)) {
    return { ok: false, error: "That code has been fully redeemed." };
  }
  const total = Number(amount) || 0;
  if (Number(row.min_amount) > 0 && total < Number(row.min_amount)) {
    return {
      ok: false,
      error: `That code works on orders of ${settings.currency_symbol || "₹"}${row.min_amount} or more.`,
    };
  }
  let discount = row.kind === "flat" ? Number(row.value) : Math.round((total * Number(row.value)) / 100);
  discount = Math.max(0, Math.min(total - 1, discount));
  if (discount <= 0) return { ok: false, error: "That code does not change this order." };
  return {
    ok: true,
    code: row.code,
    couponId: row.id,
    discount,
    total: total - discount,
    label: row.kind === "flat" ? `${settings.currency_symbol || "₹"}${row.value} off` : `${row.value}% off`,
  };
}

/* ------------------------------- site extras ----------------------------- */

export async function siteExtras(env, settings) {
  const db = env.DB;
  const features = readFeatures(settings);
  const [bundles, posts, reviews, recent] = await Promise.all([
    db.prepare("SELECT * FROM bundles WHERE status = 'active' ORDER BY sort ASC, created_at DESC LIMIT 12").all(),
    db.prepare("SELECT id, slug, title, excerpt, body, cover, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 24").all(),
    db.prepare("SELECT id, ebook_id, name, rating, body, source, created_at FROM reviews WHERE status = 'active' ORDER BY created_at DESC LIMIT 200").all(),
    db
      .prepare("SELECT name, item_title, paid_at, country FROM orders WHERE status = 'paid' AND paid_at != '' ORDER BY paid_at DESC LIMIT 24")
      .all(),
  ]);

  const ebookRows = await db
    .prepare("SELECT id, title, slug, price, cover, category, file_name FROM ebooks WHERE status = 'active'")
    .all();
  const ebookMap = Object.fromEntries((ebookRows.results || []).map((row) => [row.id, row]));

  const bundleList = (bundles.results || [])
    .map((row) => {
      const ids = json(row.ebook_ids, []);
      const items = ids.map((id) => ebookMap[id]).filter(Boolean);
      if (!items.length) return null;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        price: row.price,
        mrp: row.mrp,
        badge: row.badge,
        cover: row.cover,
        items: items.map(({ id, title, slug, price, cover }) => ({ id, title, slug, price, cover })),
        count: items.length,
      };
    })
    .filter(Boolean);

  // Real purchases only. Every entry carries its real timestamp so the storefront
  // can say "12 minutes ago" without inventing a story.
  const firstNames = (recent.results || []).map((row) => ({
    name: String(row.name || "A reader").split(" ")[0].slice(0, 24),
    title: String(row.item_title || "").slice(0, 60),
    city: String(row.country || "").slice(0, 40),
    at: row.paid_at,
  }));
  const paidCount = (recent.results || []).length;

  const gateway = gatewayState(settings);
  const bumpBook = features.orderBump && settings.bump_ebook_id ? ebookMap[settings.bump_ebook_id] : null;
  const bumpPrice = Math.max(0, U.toInt(settings.bump_price, 0));
  const bump =
    bumpBook && bumpPrice > 0
      ? {
          id: bumpBook.id,
          title: bumpBook.title,
          slug: bumpBook.slug,
          cover: bumpBook.cover,
          price: bumpPrice,
          heading: settings.bump_heading || `Add ${bumpBook.title} for ${bumpPrice}`,
          note: settings.bump_note || "",
        }
      : null;

  return {
    features,
    bump,
    // Public pixel id only. The Conversions API token stays server-side.
    metaPixelId: settings.meta_pixel_enabled === "1" ? U.clean(settings.meta_pixel_id, 30) : "",
    currency: gateway.currency,
    currencySymbol: gateway.symbol,
    payment: gateway.public,
    bundles: bundleList,
    posts: features.journal ? posts.results || [] : [],
    reviews: features.reviews ? reviews.results || [] : [],
    socialProof: features.socialProof ? firstNames : [],
    trust: {
      readers: paidCount,
      reviews: (reviews.results || []).length,
      ebooks: ebookRows.results ? ebookRows.results.length : 0,
    },
    newsletter: {
      heading: settings.newsletter_heading || "",
      note: settings.newsletter_note || "",
    },
    whatsapp: {
      number: String(settings.whatsapp || "").replace(/[^\d+]/g, ""),
      note: settings.whatsapp_note || "",
    },
    exitOffer: features.exitIntent
      ? {
          heading: settings.exit_offer_heading || "",
          note: settings.exit_offer_note || "",
          code: normaliseCode(settings.exit_coupon_code),
        }
      : null,
    aiReady: settings.ai_enabled !== "0",
    // The assistant always answers: the model when a key works, the built-in
    // quick answers otherwise.
    aiAvailable: settings.ai_enabled !== "0",
  };
}

/* ------------------------------- purchases -------------------------------- */

export async function resolvePurchase(env, settings, body = {}) {
  const db = env.DB;
  const features = readFeatures(settings);
  const bundleId = U.clean(body.bundleId, 40);

  if (bundleId) {
    if (!features.bundles) return { error: "Bundles are switched off right now." };
    const bundle = await db.prepare("SELECT * FROM bundles WHERE id = ? AND status = 'active'").bind(bundleId).first();
    if (!bundle) return { error: "That bundle is not available." };
    const ids = json(bundle.ebook_ids, []);
    const ebooks = [];
    for (const id of ids) {
      const row = await db.prepare("SELECT * FROM ebooks WHERE id = ? AND status = 'active'").bind(id).first();
      if (row) ebooks.push({ id: row.id, title: row.title, slug: row.slug });
    }
    if (!ebooks.length) return { error: "That bundle has no live ebooks right now." };
    return {
      kind: "bundle",
      itemTitle: bundle.title,
      amount: Number(bundle.price) || 0,
      meta: { bundleId: bundle.id, ebookIds: ebooks.map((book) => book.id), items: ebooks },
      ebook: null,
    };
  }

  if (body.kind === "resell") {
    if (settings.resell_enabled !== "1") return { error: "Resell licences are closed right now." };
    return {
      kind: "resell",
      itemTitle: "Resell Licence — 1 year",
      amount: U.toInt(settings.resell_price, 399),
      meta: {},
      ebook: null,
    };
  }

  const ebook = await db
    .prepare("SELECT * FROM ebooks WHERE id = ? AND status = 'active'")
    .bind(U.clean(body.ebookId, 40))
    .first();
  if (!ebook) return { error: "That ebook is not available right now." };

  // Checkout bump: the browser only sends an ebook id; the price comes from the
  // saved setting so the amount can never be edited from the page.
  let bump = null;
  const bumpId = U.clean(body.bumpId, 40);
  if (features.orderBump && bumpId && bumpId === U.clean(settings.bump_ebook_id, 40) && bumpId !== ebook.id) {
    const row = await db.prepare("SELECT * FROM ebooks WHERE id = ? AND status = 'active'").bind(bumpId).first();
    const price = U.toInt(settings.bump_price, 0);
    if (row && price > 0) bump = { row, price };
  }
  const items = bump ? [ebook, bump.row] : [ebook];
  return {
    kind: "ebook",
    itemTitle: bump ? `${ebook.title} + ${bump.row.title}` : ebook.title,
    amount: (Number(ebook.price) || 0) + (bump ? bump.price : 0),
    meta: {
      ebookIds: items.map((row) => row.id),
      items: items.map((row) => ({ id: row.id, title: row.title, slug: row.slug })),
      bump: bump ? { id: bump.row.id, title: bump.row.title, price: bump.price } : null,
    },
    ebook,
  };
}

/* ------------------------------ public routes ----------------------------- */

export async function publicRoute(request, env, url) {
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const db = env.DB;

  if (path === "/api/coupons/validate" && method === "POST") {
    if (!rateLimit(`coupon:${ipOf(request)}`, 30, 10 * 60 * 1000)) return U.bad("Too many tries. Wait a moment.", 429);
    const settings = await getSettings(db);
    const body = await readJson(request);
    const result = await validateCoupon(db, settings, {
      code: body.code,
      amount: U.toInt(body.amount, 0),
    });
    return result.ok ? U.json(result) : U.bad(result.error, 400);
  }

  if (path === "/api/newsletter" && method === "POST") {
    if (!rateLimit(`news:${ipOf(request)}`, 8, 60 * 60 * 1000)) return U.bad("Too many signups from here. Try later.", 429);
    const settings = await getSettings(db);
    if (!readFeatures(settings).newsletter) return U.bad("Newsletter is closed right now.", 403);
    const body = await readJson(request);
    const email = U.clean(body.email, 160).toLowerCase();
    if (!U.isEmail(email)) return U.bad("Enter a valid email.");
    await db
      .prepare("INSERT INTO subscribers (id, email, source, status, created_at) VALUES (?, ?, ?, 'active', ?) ON CONFLICT (email) DO NOTHING")
      .bind(U.hex(8), email, U.clean(body.source, 40) || "footer", new Date().toISOString())
      .run();
    return U.json({ ok: true });
  }

  if (path === "/api/reviews" && method === "POST") {
    if (!rateLimit(`review:${ipOf(request)}`, 12, 60 * 60 * 1000)) return U.bad("Too many reviews from here. Try later.", 429);
    const settings = await getSettings(db);
    if (!readFeatures(settings).reviews) return U.bad("Reviews are closed right now.", 403);
    const body = await readJson(request);
    const ebookId = U.clean(body.ebookId, 40);
    const ref = U.clean(body.orderRef, 40).toUpperCase();
    const email = U.clean(body.email, 160).toLowerCase();
    const rating = Math.min(5, Math.max(1, U.toInt(body.rating, 5)));
    const text = U.clean(body.body, 1200);
    if (text.length < 10) return U.bad("Write a little more — one honest sentence at least.");

    const order = await db.prepare("SELECT * FROM orders WHERE UPPER(ref) = ?").bind(ref).first();
    if (!order) return U.bad("We could not find that order reference.", 404);
    if (String(order.email).toLowerCase() !== email) return U.bad("That email does not match the order.", 403);
    if (order.status !== "paid") return U.bad("Reviews open after a paid order.", 403);
    const meta = json(order.meta, {});
    const bought = order.kind === "bundle" ? meta.ebookIds || [] : [order.ebook_id];
    if (ebookId && !bought.includes(ebookId)) return U.bad("That ebook was not part of this order.", 403);

    const existing = await db
      .prepare("SELECT 1 AS x FROM reviews WHERE order_ref = ? AND ebook_id = ?")
      .bind(order.ref, ebookId || bought[0] || "")
      .first();
    if (existing) return U.bad("You already reviewed this purchase — thank you!", 409);

    await db
      .prepare("INSERT INTO reviews (id, ebook_id, order_ref, name, email, rating, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
      .bind(U.hex(8), ebookId || bought[0] || "", order.ref, order.name, order.email, rating, text, new Date().toISOString())
      .run();
    return U.json({ ok: true, message: "Thank you — your review is queued for a quick check." });
  }

  if (path === "/api/assistant" && method === "POST") {
    if (!rateLimit(`ai:${ipOf(request)}`, 25, 60 * 60 * 1000)) return U.bad("The assistant needs a breather. Try again in a bit.", 429);
    const settings = await getSettings(db);
    if (!readFeatures(settings).assistant || settings.ai_enabled === "0") return U.bad("The assistant is offline right now.", 403);
    const body = await readJson(request);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
    if (!messages.length) return U.bad("Ask a question first.");
    const ebooks = await db
      .prepare("SELECT title, slug, subtitle, category, price FROM ebooks WHERE status = 'active' ORDER BY sort LIMIT 24")
      .all();
    try {
      const result = await assistantReply({ settings, env, messages, catalog: ebooks.results || [] });
      return U.json(result);
    } catch (error) {
      // The attempts carry the real reason (bad key, retired model, empty free
      // quota), so keep them in the log instead of just "busy".
      console.error("assistant_failed", error && error.message, JSON.stringify((error && error.attempts) || []));
      const last = [...messages].reverse().find((message) => message.role !== "assistant");
      return U.json({
        reply: fallbackReply({ question: last ? last.content : "", settings, catalog: ebooks.results || [] }),
        meta: { provider: "Quick answers", model: "built-in", fallback: true },
      });
    }
  }

  return null;
}

/* ------------------------------- admin routes ----------------------------- */

export async function adminExtras(env, settings) {
  const db = env.DB;
  const [coupons, bundles, posts, subscribers, reviews, auditRows] = await Promise.all([
    db.prepare("SELECT * FROM coupons ORDER BY created_at DESC LIMIT 200").all(),
    db.prepare("SELECT * FROM bundles ORDER BY sort ASC, created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 500").all(),
    db.prepare("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 300").all(),
    db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 120").all(),
  ]);
  return {
    coupons: (coupons.results || []).map((row) => ({ ...row })),
    bundles: (bundles.results || []).map((row) => ({ ...row, ebook_ids: json(row.ebook_ids, []) })),
    posts: posts.results || [],
    subscribers: subscribers.results || [],
    reviews: reviews.results || [],
    audit: auditRows.results || [],
    ai: aiStatus(settings, env),
    gateways: gatewayState(settings),
  };
}

async function pgUpsert(db, table, columns, values, conflictKey) {
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((column) => column !== conflictKey)
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  await db
    .prepare(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflictKey}) DO UPDATE SET ${updates}`
    )
    .bind(...values)
    .run();
}

export async function adminRoute(request, env, url, admin) {
  const db = env.DB;
  const path = url.pathname.replace(/^\/api\/admin/, "");
  const method = request.method.toUpperCase();
  const settings = await getSettings(db);

  /* --------------------------------- coupons -------------------------------- */
  if (path === "/coupons" && method === "POST") {
    const body = await readJson(request);
    const id = U.clean(body.id, 40);
    const code = normaliseCode(body.code);
    if (code.length < 3) return U.bad("Code needs at least 3 characters (letters/numbers).");
    const kind = body.kind === "flat" ? "flat" : "percent";
    let value = U.toInt(body.value, 0);
    if (kind === "percent") value = Math.min(100, Math.max(1, value));
    else value = Math.max(1, value);
    const row = {
      code,
      kind,
      value,
      min_amount: Math.max(0, U.toInt(body.min_amount, 0)),
      max_uses: Math.max(0, U.toInt(body.max_uses, 0)),
      expires_at: U.clean(body.expires_at, 40),
      status: body.status === "paused" ? "paused" : "active",
    };
    const clash = await db.prepare("SELECT id FROM coupons WHERE UPPER(code) = ?").bind(code).first();
    if (clash && clash.id !== id) return U.bad("That code already exists.");
    if (id) {
      await db
        .prepare("UPDATE coupons SET code=?, kind=?, value=?, min_amount=?, max_uses=?, expires_at=?, status=? WHERE id=?")
        .bind(row.code, row.kind, row.value, row.min_amount, row.max_uses, row.expires_at, row.status, id)
        .run();
    } else {
      await db
        .prepare("INSERT INTO coupons (id, code, kind, value, min_amount, max_uses, used, expires_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)")
        .bind(U.hex(8), row.code, row.kind, row.value, row.min_amount, row.max_uses, row.expires_at, row.status, new Date().toISOString())
        .run();
    }
    await audit(db, admin, "coupon_saved", `${code} ${kind} ${value}`, request);
    return U.json({ ok: true });
  }
  let m = path.match(/^\/coupons\/([^/]+)\/delete$/);
  if (m && method === "POST") {
    await db.prepare("DELETE FROM coupons WHERE id = ?").bind(decodeURIComponent(m[1])).run();
    await audit(db, admin, "coupon_deleted", decodeURIComponent(m[1]), request);
    return U.json({ ok: true });
  }

  /* --------------------------------- bundles -------------------------------- */
  if (path === "/bundles" && method === "POST") {
    const body = await readJson(request);
    const id = U.clean(body.id, 40);
    const title = U.oneLine(body.title, 120);
    if (title.length < 3) return U.bad("Give the bundle a title.");
    let ids = Array.isArray(body.ebook_ids) ? body.ebook_ids.map((value) => U.clean(value, 40)).filter(Boolean) : [];
    ids = Array.from(new Set(ids)).slice(0, 20);
    if (!ids.length) return U.bad("Pick at least one ebook.");
    const existing = [];
    for (const ebookId of ids) {
      const row = await db.prepare("SELECT id FROM ebooks WHERE id = ?").bind(ebookId).first();
      if (row) existing.push(ebookId);
    }
    if (!existing.length) return U.bad("Those ebooks no longer exist.");
    const price = Math.max(0, U.toInt(body.price, 0));
    let slug = U.slugify(body.slug || title);
    const row = {
      slug,
      title,
      subtitle: U.oneLine(body.subtitle, 220),
      ebook_ids: JSON.stringify(existing),
      price,
      mrp: Math.max(price, U.toInt(body.mrp, 0)),
      badge: U.oneLine(body.badge, 40),
      cover: U.clean(body.cover, 400),
      status: body.status === "draft" ? "draft" : "active",
      sort: U.toInt(body.sort, 0),
    };
    if (id) {
      await db
        .prepare("UPDATE bundles SET slug=?, title=?, subtitle=?, ebook_ids=?, price=?, mrp=?, badge=?, cover=?, status=?, sort=? WHERE id=?")
        .bind(row.slug, row.title, row.subtitle, row.ebook_ids, row.price, row.mrp, row.badge, row.cover, row.status, row.sort, id)
        .run();
    } else {
      const clash = await db.prepare("SELECT 1 AS x FROM bundles WHERE slug = ?").bind(slug).first();
      if (clash) slug = `${slug}-${U.hex(2)}`;
      await db
        .prepare("INSERT INTO bundles (id, slug, title, subtitle, ebook_ids, price, mrp, badge, cover, status, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(U.hex(8), slug, row.title, row.subtitle, row.ebook_ids, row.price, row.mrp, row.badge, row.cover, row.status, row.sort, new Date().toISOString())
        .run();
    }
    await audit(db, admin, "bundle_saved", title, request);
    return U.json({ ok: true });
  }
  m = path.match(/^\/bundles\/([^/]+)\/delete$/);
  if (m && method === "POST") {
    await db.prepare("DELETE FROM bundles WHERE id = ?").bind(decodeURIComponent(m[1])).run();
    await audit(db, admin, "bundle_deleted", decodeURIComponent(m[1]), request);
    return U.json({ ok: true });
  }

  /* --------------------------------- journal -------------------------------- */
  if (path === "/posts" && method === "POST") {
    const body = await readJson(request);
    const id = U.clean(body.id, 40);
    const title = U.oneLine(body.title, 160);
    if (title.length < 3) return U.bad("Give the post a title.");
    const status = body.status === "published" ? "published" : "draft";
    const now = new Date().toISOString();
    const row = {
      title,
      slug: U.slugify(body.slug || title),
      excerpt: U.clean(body.excerpt, 400),
      body: U.clean(body.body, 30000),
      cover: U.clean(body.cover, 400),
      status,
      published_at: status === "published" ? U.clean(body.published_at, 40) || now : U.clean(body.published_at, 40),
    };
    if (id) {
      await db
        .prepare("UPDATE posts SET slug=?, title=?, excerpt=?, body=?, cover=?, status=?, published_at=? WHERE id=?")
        .bind(row.slug, row.title, row.excerpt, row.body, row.cover, row.status, row.published_at, id)
        .run();
    } else {
      const clash = await db.prepare("SELECT 1 AS x FROM posts WHERE slug = ?").bind(row.slug).first();
      if (clash) row.slug = `${row.slug}-${U.hex(2)}`;
      await db
        .prepare("INSERT INTO posts (id, slug, title, excerpt, body, cover, status, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(U.hex(8), row.slug, row.title, row.excerpt, row.body, row.cover, row.status, row.published_at, now)
        .run();
    }
    await audit(db, admin, "post_saved", title, request);
    return U.json({ ok: true });
  }
  m = path.match(/^\/posts\/([^/]+)\/delete$/);
  if (m && method === "POST") {
    await db.prepare("DELETE FROM posts WHERE id = ?").bind(decodeURIComponent(m[1])).run();
    await audit(db, admin, "post_deleted", decodeURIComponent(m[1]), request);
    return U.json({ ok: true });
  }

  /* -------------------------------- subscribers ----------------------------- */
  m = path.match(/^\/subscribers\/([^/]+)\/delete$/);
  if (m && method === "POST") {
    await db.prepare("DELETE FROM subscribers WHERE id = ?").bind(decodeURIComponent(m[1])).run();
    return U.json({ ok: true });
  }
  if (path === "/export/subscribers.csv" && method === "GET") {
    const rows = await db.prepare("SELECT email, source, status, created_at FROM subscribers ORDER BY created_at DESC").all();
    const lines = ["email,source,status,created_at"];
    for (const row of rows.results || []) {
      lines.push([row.email, row.source, row.status, row.created_at].map(U.csvCell).join(","));
    }
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  /* ---------------------------------- reviews ------------------------------- */
  if (path === "/reviews" && method === "POST") {
    const body = await readJson(request);
    const id = U.clean(body.id, 40);
    const ebookId = U.clean(body.ebook_id, 40);
    if (!ebookId) return U.bad("Pick the ebook this review belongs to.");
    const ebook = await db.prepare("SELECT id FROM ebooks WHERE id = ?").bind(ebookId).first();
    if (!ebook) return U.bad("That ebook does not exist any more.", 404);
    const name = U.oneLine(body.name, 60) || "Reader";
    const rating = Math.min(5, Math.max(1, U.toInt(body.rating, 5)));
    const text = U.clean(body.body, 1200);
    if (text.length < 10) return U.bad("A review needs at least one honest sentence.");
    const status = body.status === "pending" ? "pending" : body.status === "hidden" ? "hidden" : "active";
    const source = body.source === "editorial" ? "editorial" : "customer";
    const orderRef = U.clean(body.order_ref, 40).toUpperCase();
    if (id) {
      await db
        .prepare("UPDATE reviews SET ebook_id=?, name=?, rating=?, body=?, status=?, source=?, order_ref=? WHERE id=?")
        .bind(ebookId, name, rating, text, status, source, orderRef, id)
        .run();
    } else {
      await db
        .prepare("INSERT INTO reviews (id, ebook_id, order_ref, name, email, rating, body, status, source, created_at) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?)")
        .bind(U.hex(8), ebookId, orderRef, name, rating, text, status, source, new Date().toISOString())
        .run();
    }
    await audit(db, admin, "review_saved", `${name} · ${rating}★`, request);
    return U.json({ ok: true });
  }

  // AI drafts from the ebook's own copy. Saved as editorial drafts, never as
  // verified purchases, so the rating block stays honest.
  if (path === "/reviews/generate" && method === "POST") {
    if (!rateLimit(`reviewgen:${admin.id}`, 30, 60 * 60 * 1000)) return U.bad("AI review limit reached for this hour.", 429);
    const body = await readJson(request);
    const ebookId = U.clean(body.ebookId, 40);
    const ebook = await db.prepare("SELECT * FROM ebooks WHERE id = ?").bind(ebookId).first();
    if (!ebook) return U.bad("Pick an ebook first.", 404);
    try {
      const result = await generateReviews({
        settings,
        env,
        ebook: { ...ebook, highlights: json(ebook.highlights, []) },
        count: U.toInt(body.count, 3),
      });
      if (body.create) {
        const status = body.status === "active" ? "active" : "pending";
        for (const review of result.reviews) {
          await db
            .prepare("INSERT INTO reviews (id, ebook_id, order_ref, name, email, rating, body, status, source, created_at) VALUES (?, ?, '', ?, '', ?, ?, ?, 'editorial', ?)")
            .bind(U.hex(8), ebook.id, review.name, review.rating, review.body, status, new Date().toISOString())
            .run();
        }
      }
      await audit(db, admin, "review_ai", `${ebook.title} · ${result.reviews.length} drafts`, request);
      return U.json({ ok: true, reviews: result.reviews, meta: result.meta });
    } catch (error) {
      return U.json({ ok: false, error: error.message, attempts: error.attempts || [] }, 502);
    }
  }

  m = path.match(/^\/reviews\/([^/]+)$/);
  if (m && method === "POST") {
    const id = decodeURIComponent(m[1]);
    const body = await readJson(request);
    const action = U.clean(body.action, 20);
    if (action === "delete") {
      await db.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
    } else {
      const status = action === "hide" ? "hidden" : action === "pending" ? "pending" : "active";
      await db.prepare("UPDATE reviews SET status = ? WHERE id = ?").bind(status, id).run();
    }
    return U.json({ ok: true });
  }

  /* ----------------------------------- AI ----------------------------------- */
  if (path === "/ai/status" && method === "GET") return U.json(aiStatus(settings, env));

  if (path === "/ai/test" && method === "POST") {
    if (!rateLimit(`aitest:${admin.id}`, 10, 10 * 60 * 1000)) return U.bad("Easy — try again in a few minutes.", 429);
    try {
      return U.json(await testAi({ settings, env }));
    } catch (error) {
      return U.json({ ok: false, error: error.message, attempts: error.attempts || [] }, 502);
    }
  }

  if (path === "/ai/analyze" && method === "POST") {
    if (!rateLimit(`aiadmin:${admin.id}`, 40, 60 * 60 * 1000)) return U.bad("AI generation limit reached for this hour.", 429);
    const body = await readJson(request);
    const ebookId = U.clean(body.ebookId, 40);
    const fileKey = U.clean(body.fileKey, 400);
    let ebook = {};
    if (ebookId) {
      const row = await db.prepare("SELECT * FROM ebooks WHERE id = ?").bind(ebookId).first();
      if (!row) return U.bad("Ebook not found.", 404);
      ebook = { ...row, highlights: json(row.highlights, []) };
    }
    let extracted = U.clean(body.text, 60000);
    let note = "";
    // Prefer an explicit upload; otherwise read the ebook's already-stored PDF.
    const sourceKey = fileKey || U.clean(ebook.file_key, 400) || "";
    // Demo/seeded placeholders ("demo:1") have no real file — analyse the title and
    // notes instead of failing.
    if (!extracted && /^(pdf|media)\//.test(sourceKey)) {
      if (!env.FILES) return U.bad("File storage is not configured.", 503);
      const object = await env.FILES.get(sourceKey);
      if (!object) return U.bad("That PDF is missing from storage. Upload it again.", 404);
      const buffer = await object.arrayBuffer();
      const parsed = await pdfToText(buffer);
      extracted = parsed.text;
      note = parsed.note;
    }
    if (!extracted && !body.notes && !ebook.title) return U.bad("Upload a PDF, or write a title and a few notes.");
    try {
      const result = await analyzeEbook({
        settings,
        env,
        ebook: { ...ebook, title: ebook.title || U.clean(body.title, 160) },
        text: extracted,
        notes: U.clean(body.notes, 4000),
        tone: U.clean(body.tone, 400),
        currency: settings.currency || "INR",
      });
      if (ebookId) {
        await db
          .prepare("UPDATE ebooks SET ai_meta = ? WHERE id = ?")
          .bind(JSON.stringify({ ...result, _at: new Date().toISOString() }).slice(0, 60000), ebookId)
          .run();
      }
      await audit(db, admin, "ai_analyze", ebook.title || U.clean(body.title, 120) || fileKey, request);
      return U.json({
        ok: true,
        result,
        extractedChars: extracted.length,
        note,
      });
    } catch (error) {
      return U.json({ ok: false, error: error.message, attempts: error.attempts || [] }, 502);
    }
  }

  if (path === "/ai/section" && method === "POST") {
    if (!rateLimit(`aiadmin:${admin.id}`, 40, 60 * 60 * 1000)) return U.bad("AI generation limit reached for this hour.", 429);
    const body = await readJson(request);
    let ebook = body.ebook && typeof body.ebook === "object" ? body.ebook : {};
    const ebookId = U.clean(body.ebookId, 40);
    if (ebookId && !ebook.title) {
      const row = await db.prepare("SELECT * FROM ebooks WHERE id = ?").bind(ebookId).first();
      if (row) ebook = { ...row, highlights: json(row.highlights, []) };
    }
    try {
      const result = await generateSection({
        settings,
        env,
        section: U.clean(body.section, 30),
        ebook,
        notes: U.clean(body.notes, 2000),
        tone: U.clean(body.tone, 400),
      });
      return U.json({ ok: true, ...result });
    } catch (error) {
      return U.json({ ok: false, error: error.message, attempts: error.attempts || [] }, 502);
    }
  }

  if (path === "/ai/store" && method === "POST") {
    if (!rateLimit(`aiadmin:${admin.id}`, 40, 60 * 60 * 1000)) return U.bad("AI generation limit reached for this hour.", 429);
    const body = await readJson(request);
    const books = await db.prepare("SELECT title, subtitle, category FROM ebooks WHERE status = 'active' LIMIT 12").all();
    try {
      const result = await generateStore({
        settings,
        env,
        prompt: U.clean(body.prompt, 2000),
        catalog: books.results || [],
        tone: U.clean(body.tone, 400),
      });
      return U.json({ ok: true, ...result });
    } catch (error) {
      return U.json({ ok: false, error: error.message, attempts: error.attempts || [] }, 502);
    }
  }

  if (path === "/ai/rewrite" && method === "POST") {
    if (!rateLimit(`aiadmin:${admin.id}`, 60, 60 * 60 * 1000)) return U.bad("AI generation limit reached for this hour.", 429);
    const body = await readJson(request);
    try {
      const result = await rewriteBlock({
        settings,
        env,
        block: body.block && typeof body.block === "object" ? body.block : {},
        instruction: U.clean(body.instruction, 600),
        tone: U.clean(body.tone, 400),
      });
      return U.json({ ok: true, ...result });
    } catch (error) {
      return U.json({ ok: false, error: error.message, attempts: error.attempts || [] }, 502);
    }
  }

  /* -------------------------------- payments -------------------------------- */
  if (path === "/payments/test" && method === "POST") {
    if (!rateLimit(`paytest:${admin.id}`, 20, 10 * 60 * 1000)) return U.bad("Try again in a few minutes.", 429);
    try {
      return U.json(await testGateways(settings));
    } catch (error) {
      return U.bad(`Could not test gateways: ${String(error.message || error).slice(0, 160)}`, 502);
    }
  }

  /* -------------------------------- security -------------------------------- */
  if (path === "/security/sessions" && method === "GET") {
    const rows = await db.prepare("SELECT token, created_at, expires_at FROM sessions ORDER BY created_at DESC LIMIT 50").all();
    return U.json({
      sessions: (rows.results || []).map((row) => ({
        id: String(row.token).slice(-8),
        created_at: row.created_at,
        expires_at: row.expires_at,
        current: row.token === admin.token,
        expired: new Date(row.expires_at).getTime() < Date.now(),
      })),
    });
  }
  if (path === "/security/revoke-others" && method === "POST") {
    await db.prepare("DELETE FROM sessions WHERE token != ?").bind(admin.token).run();
    await audit(db, admin, "sessions_revoked", "all other sessions signed out", request);
    return U.json({ ok: true });
  }

  // Content backups (with images and restore) live in worker/backup.js and are
  // mounted by handleAdmin before this router.

  return null;
}

async function readJson(request) {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}
