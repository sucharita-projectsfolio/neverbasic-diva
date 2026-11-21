// Neverbasic Diva — API worker.
// Public storefront API + admin panel API, backed by D1 and R2.
import { ensureReady, getSettings, setSetting, logEvent, createAdmin, DEFAULT_SETTINGS } from "./db.js";
import * as U from "./util.js";

const ADMIN_COOKIE = "nbd_admin";
const PUBLIC_KEYS = [
  "brand_name", "brand_tagline", "instagram", "support_email", "whatsapp", "announcement",
  "hero_eyebrow", "hero_title", "hero_sub", "hero_note", "accent_color", "ink_color", "bg_color",
  "payment_link", "upi_id", "pay_instructions", "resell_price", "resell_enabled",
  "resell_commission_note", "refund_window_days", "refund_policy", "terms", "license_terms",
  "privacy", "about", "faqs", "stats", "payu_mode",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      await ensureReady(env);
      return await handleApi(request, env, url);
    } catch (error) {
      console.error("api_failure", url.pathname, error && error.stack ? error.stack : error);
      return U.bad("Something went wrong on our side. Please try again.", 500);
    }
  },
};

/* ------------------------------- routing --------------------------------- */

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const db = env.DB;

  if (path === "/api/health") return U.json({ ok: true });

  if (path === "/api/site" && method === "GET") return sitePayload(env);
  if (path === "/api/track" && method === "POST") return trackVisit(env, request);

  if (path === "/api/orders" && method === "POST") return createOrder(env, request);

  let m = path.match(/^\/api\/orders\/([^/]+)$/);
  if (m && method === "GET") return orderLookup(env, decodeURIComponent(m[1]), url);

  m = path.match(/^\/api\/orders\/([^/]+)\/claim$/);
  if (m && method === "POST") return claimPayment(env, decodeURIComponent(m[1]), request);

  m = path.match(/^\/api\/download\/([^/]+)$/);
  if (m && method === "GET") return deliverDownload(env, decodeURIComponent(m[1]));

  if (path === "/api/payu/return" && (method === "POST" || method === "GET")) return payuReturn(request, env);
  if (path === "/api/payu/webhook" && method === "POST") return payuReturn(request, env, true);

  m = path.match(/^\/api\/media\/(.+)$/);
  if (m && method === "GET") return serveMedia(env, decodeURIComponent(m[1]));

  if (path === "/api/tickets" && method === "POST") return createTicket(env, request);
  m = path.match(/^\/api\/tickets\/([^/]+)$/);
  if (m && method === "GET") return getTicket(env, decodeURIComponent(m[1]), url);
  m = path.match(/^\/api\/tickets\/([^/]+)\/reply$/);
  if (m && method === "POST") return replyTicket(env, decodeURIComponent(m[1]), request);

  if (path === "/api/requests" && method === "POST") return createRequest(env, request);
  if (path === "/api/refunds" && method === "POST") return createRefund(env, request);
  if (path === "/api/reseller/lookup" && method === "POST") return resellerLookup(env, request);
  m = path.match(/^\/api\/reseller\/download\/([^/]+)$/);
  if (m && method === "GET") return resellerDownload(env, decodeURIComponent(m[1]), url);
  if (path === "/api/admin/setup" && method === "POST") return adminSetup(env, request);
  if (path === "/api/admin/login" && method === "POST") return adminLogin(env, request);
  if (path === "/api/admin/logout" && method === "POST") {
    return U.json({ ok: true }, 200, { "set-cookie": U.clearCookie(ADMIN_COOKIE) });
  }
  if (path === "/api/admin/session" && method === "GET") {
    const admin = await requireAdmin(request, env);
    const count = await db.prepare("SELECT COUNT(*) AS n FROM admins").first();
    return U.json({ setup: !count || !count.n, admin: admin ? { email: admin.email } : null });
  }

  if (path.startsWith("/api/admin/")) {
    const admin = await requireAdmin(request, env);
    if (!admin) return U.bad("Please sign in again.", 401);
    return handleAdmin(request, env, url, admin);
  }

  return U.bad("Not found", 404);
}

/* --------------------------------- site ---------------------------------- */

async function sitePayload(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  const ebooks = await db
    .prepare("SELECT * FROM ebooks WHERE status = 'active' ORDER BY sort ASC, created_at DESC")
    .all();
  const testimonials = await db
    .prepare("SELECT * FROM testimonials WHERE status = 'active' ORDER BY sort ASC, created_at DESC")
    .all();

  const pub = {};
  for (const key of PUBLIC_KEYS) pub[key] = settings[key] ?? DEFAULT_SETTINGS[key] ?? "";
  pub.faqs = safeJson(pub.faqs, []);
  pub.stats = safeJson(pub.stats, []);
  pub.payment = {
    payu: settings.payu_enabled === "1" && !!settings.payu_key && !!settings.payu_salt,
    payuMode: settings.payu_mode === "live" ? "live" : "test",
    link: (settings.payment_link || "").trim(),
    upi: (settings.upi_id || "").trim(),
  };
  return U.json({
    settings: pub,
    ebooks: (ebooks.results || []).map(publicEbook),
    testimonials: testimonials.results || [],
  });
}

function publicEbook(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    highlights: safeJson(row.highlights, []),
    category: row.category,
    pages: row.pages,
    price: row.price,
    mrp: row.mrp,
    cover: row.cover,
    badge: row.badge,
    featured: row.featured,
    status: row.status,
    sort: row.sort,
  };
}

function safeJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function trackVisit(env, request) {
  const body = await readJson(request);
  const path = U.clean(body.path, 120) || "/";
  if (path.startsWith("/admin")) return U.json({ ok: true });
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    "INSERT INTO visits (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = visits.count + 1"
  )
    .bind(day, path)
    .run();
  const res = U.clean(body.res, 24);
  if (res) {
    await env.DB.prepare(
      "UPDATE resellers SET clicks = clicks + 1 WHERE UPPER(code) = UPPER(?) AND status = 'active'"
    )
      .bind(res)
      .run();
  }
  return U.json({ ok: true });
}

async function serveMedia(env, key) {
  if (!key.startsWith("covers/") && !key.startsWith("media/")) return U.bad("Not found", 404);
  if (!env.FILES) return U.bad("Storage not configured", 503);
  const object = await env.FILES.get(key);
  if (!object) return U.bad("Not found", 404);
  const type = key.endsWith(".png")
    ? "image/png"
    : key.endsWith(".webp")
      ? "image/webp"
      : key.endsWith(".svg")
        ? "image/svg+xml"
        : "image/jpeg";
  return new Response(object.body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/* -------------------------------- orders --------------------------------- */

async function createOrder(env, request) {
  const db = env.DB;
  const body = await readJson(request);
  const settings = await getSettings(db);
  const kind = body.kind === "resell" ? "resell" : "ebook";
  const name = U.oneLine(body.name, 80);
  const email = U.clean(body.email, 160).toLowerCase();
  const phone = U.clean(body.phone, 20);

  if (name.length < 2) return U.bad("Please add your name.");
  if (!U.isEmail(email)) return U.bad("Please add a valid email — your access is tied to it.");
  if (!/^[0-9+\-\s()]{6,20}$/.test(phone)) return U.bad("Please add a valid phone number.");

  let ebook = null;
  let amount = 0;
  let itemTitle = "";
  if (kind === "ebook") {
    ebook = await db.prepare("SELECT * FROM ebooks WHERE id = ? AND status = 'active'").bind(U.clean(body.ebookId, 40)).first();
    if (!ebook) return U.bad("That ebook is not available right now.");
    amount = Number(ebook.price) || 0;
    itemTitle = ebook.title;
  } else {
    if (settings.resell_enabled !== "1") return U.bad("Resell licences are closed right now.");
    amount = U.toInt(settings.resell_price, 399);
    itemTitle = "Resell Licence — 1 year";
  }

  const now = new Date();
  const ref = `NBD-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${U.hex(3).toUpperCase()}`;
  const meta = {
    instagram: U.clean(body.instagram, 60),
    audience: U.clean(body.audience, 40),
    preference: U.clean(body.preference, 40),
  };
  const resellerCode = U.clean(body.res, 24);

  await db
    .prepare(
      `INSERT INTO orders (id, ref, kind, ebook_id, item_title, name, email, phone, amount, status, payment_mode, utr, payu_txnid, payu_mode, download_token, downloads, reseller_code, meta, notes, created_at, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, '', '', '', ?, 0, ?, ?, '', ?, '')`
    )
    .bind(
      U.hex(8), ref, kind, ebook ? ebook.id : "", itemTitle, name, email, phone, amount,
      settings.payu_enabled === "1" ? "payu" : settings.payment_link ? "link" : "manual",
      U.hex(12), resellerCode, JSON.stringify(meta), now.toISOString()
    )
    .run();

  await logEvent(db, ref, "created", `${kind === "ebook" ? "Ebook" : "Resell licence"} order created · ${U.money(amount)}`);

  const order = await db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first();
  const origin = U.originOf(request);
  return U.json(await paymentInitiation(env, settings, order, origin));
}

async function paymentInitiation(env, settings, order, origin) {
  const base = {
    ref: order.ref,
    amount: order.amount,
    itemTitle: order.item_title,
    kind: order.kind,
  };

  if (settings.payu_enabled === "1" && settings.payu_key && settings.payu_salt) {
    const firstname = order.name.split(" ")[0] || "Reader";
    const fields = {
      key: settings.payu_key,
      txnid: order.ref,
      amount: Number(order.amount).toFixed(2),
      productinfo: order.item_title.slice(0, 100),
      firstname,
      email: order.email,
      phone: order.phone,
      surl: `${origin}/api/payu/return`,
      furl: `${origin}/api/payu/return`,
      udf1: order.kind,
      udf2: order.email,
      udf3: "",
      udf4: "",
      udf5: "",
      service_provider: "payu_paisa",
    };
    const hash = await U.payuRequestHash({ ...fields, salt: settings.payu_salt });
    return {
      ...base,
      mode: "payu",
      action: settings.payu_mode === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment",
      fields: { ...fields, hash },
    };
  }

  if ((settings.payment_link || "").trim()) {
    return {
      ...base,
      mode: "link",
      link: settings.payment_link.trim(),
      upi: settings.upi_id || "",
      instructions: settings.pay_instructions || "",
    };
  }

  return {
    ...base,
    mode: "manual",
    upi: settings.upi_id || "",
    instructions: settings.pay_instructions || "",
    warning:
      "No payment method is configured yet. Add PayU keys, a payment link or a UPI ID in Admin → Payments.",
  };
}

async function orderLookup(env, ref, url) {
  const db = env.DB;
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const order = await db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first();
  if (!order) return U.bad("We could not find that order reference.", 404);
  if (!email || email !== String(order.email).toLowerCase()) {
    return U.bad("Email does not match this order.", 403);
  }
  const events = await db
    .prepare("SELECT type, message, created_at FROM order_events WHERE order_ref = ? ORDER BY created_at ASC")
    .bind(ref)
    .all();
  const ebook = order.ebook_id
    ? await db.prepare("SELECT id, title, slug, cover, pages FROM ebooks WHERE id = ?").bind(order.ebook_id).first()
    : null;
  let reseller = null;
  if (order.kind === "resell" && order.status === "paid") {
    reseller = await db.prepare("SELECT * FROM resellers WHERE order_ref = ?").bind(ref).first();
  }
  const refund = await db.prepare("SELECT ref, status FROM refunds WHERE order_ref = ?").bind(ref).first();
  const settings = await getSettings(db);
  return U.json({
    payment: {
      link: order.status === "paid" ? "" : settings.payment_link || "",
      upi: settings.upi_id || "",
      instructions: settings.pay_instructions || "",
      payu: settings.payu_enabled === "1",
    },
    order: {
      ref: order.ref,
      kind: order.kind,
      itemTitle: order.item_title,
      title: order.item_title,
      name: order.name,
      email: order.email,
      phone: order.phone,
      amount: order.amount,
      status: order.status,
      paymentMode: order.payment_mode,
      utr: order.utr,
      created_at: order.created_at,
      paid_at: order.paid_at,
      downloads: order.downloads,
      downloadUrl: order.status === "paid" ? `/api/download/${order.download_token}` : "",
      refundable: order.status === "paid",
      refundWindowDays: 0,
    },
    ebook,
    events: events.results || [],
    refund: refund || null,
    reseller,
  });
}

async function claimPayment(env, ref, request) {
  const db = env.DB;
  const body = await readJson(request);
  const email = U.clean(body.email, 160).toLowerCase();
  const utr = U.clean(body.utr, 64);
  if (utr.length < 4) return U.bad("Please paste the UTR / transaction reference from your payment app.");
  const order = await db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first();
  if (!order) return U.bad("Order not found", 404);
  if (email && email !== String(order.email).toLowerCase()) return U.bad("Email does not match this order.", 403);
  if (order.status === "paid") return U.json({ ok: true, status: "paid" });
  await db
    .prepare("UPDATE orders SET utr = ?, payment_mode = 'manual', notes = ? WHERE ref = ?")
    .bind(utr, "Payment reference submitted by buyer", ref)
    .run();
  await logEvent(db, ref, "utr_submitted", `Payment reference submitted: ${utr}`);
  return U.json({ ok: true, status: "pending" });
}

async function markOrderPaid(db, ref, { txnid = "", mode = "", note = "" } = {}) {
  const order = await db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first();
  if (!order) return null;
  if (order.status === "paid") return order;
  const token = order.download_token || U.hex(12);
  await db
    .prepare(
      "UPDATE orders SET status = 'paid', paid_at = ?, download_token = ?, payu_txnid = ?, payu_mode = ?, notes = ? WHERE ref = ?"
    )
    .bind(new Date().toISOString(), token, txnid || order.payu_txnid || "", mode || order.payu_mode || "", note || order.notes || "", ref)
    .run();
  await logEvent(db, ref, "paid", note || "Payment confirmed — access unlocked");
  if (order.kind === "resell") await activateReseller(db, order);
  if (order.reseller_code) {
    await db
      .prepare("UPDATE resellers SET sales = sales + 1 WHERE UPPER(code) = UPPER(?) AND status = 'active'")
      .bind(order.reseller_code)
      .run();
  }
  return db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first();
}

async function payuReturn(request, env, isWebhook = false) {
  const db = env.DB;
  let fields = {};
  const url = new URL(request.url);
  if (request.method === "POST") {
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) fields = await readJson(request);
    else {
      const form = await request.formData();
      for (const [key, value] of form.entries()) fields[key] = typeof value === "string" ? value : "";
    }
  }
  for (const [key, value] of url.searchParams.entries()) fields[key] = value;

  const settings = await getSettings(db);
  const salt = settings.payu_salt || "";
  const ref = U.clean(fields.txnid, 60);
  const status = String(fields.status || "").toLowerCase();

  if (isWebhook) {
    if (ref && status === "success") {
      const valid = await U.payuVerifyResponse(fields, salt);
      if (valid) await markOrderPaid(db, ref, { txnid: fields.m_payment_id || "", mode: "payu", note: "Confirmed by PayU webhook" });
      else if (ref) await logEvent(db, ref, "verify_failed", "PayU webhook hash did not verify");
    }
    return U.json({ ok: true });
  }

  const order = ref ? await db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first() : null;
  const valid = fields.hash ? await U.payuVerifyResponse(fields, salt) : false;
  let outcome = "failed";
  let reason = "";

  if (!order) {
    reason = "order_not_found";
  } else if (!salt) {
    reason = "gateway_not_configured";
    await logEvent(db, ref, "verify_failed", "PayU salt is missing in settings");
  } else if (!valid) {
    reason = "hash_mismatch";
    await logEvent(db, ref, "verify_failed", "Response hash did not match — order left pending");
  } else if (status === "success") {
    const paidAmount = Number(fields.amount || 0);
    if (Number(paidAmount.toFixed(2)) < Number(Number(order.amount).toFixed(2))) {
      reason = "amount_mismatch";
      await logEvent(db, ref, "verify_failed", `Paid ${paidAmount} but order is ${order.amount}`);
    } else {
      await markOrderPaid(db, ref, {
        txnid: fields.m_payment_id || "",
        mode: "payu",
        note: `PayU ${fields.mode || "payment"} · ${fields.m_payment_id || ""}`.trim(),
      });
      outcome = "success";
    }
  } else {
    await logEvent(db, ref, "payment_failed", `PayU status: ${status || "failed"} ${fields.error_Message || ""}`.trim());
    await db.prepare("UPDATE orders SET status = 'failed' WHERE ref = ? AND status = 'pending'").bind(ref).run();
    reason = status || "failed";
  }

  const target = `${U.originOf(request)}/order/${encodeURIComponent(ref || "")}?pay=${outcome}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`;
  return new Response(null, { status: 303, headers: { location: target, "cache-control": "no-store" } });
}

async function deliverDownload(env, token) {
  const db = env.DB;
  const order = await db.prepare("SELECT * FROM orders WHERE download_token = ?").bind(token).first();
  if (!order) return U.bad("This download link is not valid.", 404);
  if (order.status !== "paid") return U.bad("This order is not paid yet.", 403);

  const ebook = order.ebook_id
    ? await db.prepare("SELECT * FROM ebooks WHERE id = ?").bind(order.ebook_id).first()
    : null;
  const fileKey = ebook ? ebook.file_key || "" : "";
  const fileName = (ebook && ebook.file_name) || `${order.ref}.pdf`;

  let body;
  let contentType = "application/pdf";
  if (!fileKey || fileKey.startsWith("demo:")) {
    body = U.demoPdf(
      ebook ? ebook.title : order.item_title,
      "Neverbasic Diva · preview copy",
      [
        "This is a preview placeholder shipped with your store so the delivery flow can be tested end to end.",
        "Admin: sign in to /admin, open Ebooks, edit this ebook and upload your real PDF. The moment it is uploaded, every paid buyer downloads that file instead.",
        "Your order access is permanent on your order page — buyers can come back to /track any time with their reference and email.",
        "Neverbasic Diva · neverbasic_diva",
      ]
    );
  } else {
    if (!env.FILES) return U.bad("File storage is not configured yet.", 503);
    const object = await env.FILES.get(fileKey);
    if (!object) return U.bad("The file is being updated. Please try again in a minute or contact support.", 404);
    body = object.body;
    if (object.httpMetadata && object.httpMetadata.contentType) contentType = object.httpMetadata.contentType;
  }

  await db.prepare("UPDATE orders SET downloads = downloads + 1 WHERE ref = ?").bind(order.ref).run();
  await logEvent(db, order.ref, "download", fileKey.startsWith("demo:") ? "Preview file downloaded" : "PDF downloaded");

  const safeName = fileName.replace(/[^\w.\-]+/g, "-");
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${safeName}"`,
      "cache-control": "no-store",
    },
  });
}

/* -------------------------------- support -------------------------------- */

async function createTicket(env, request) {
  const db = env.DB;
  const body = await readJson(request);
  const name = U.oneLine(body.name, 80);
  const email = U.clean(body.email, 160).toLowerCase();
  const subject = U.oneLine(body.subject, 120) || "Help request";
  const message = U.clean(body.message, 4000);
  if (name.length < 2) return U.bad("Please add your name.");
  if (!U.isEmail(email)) return U.bad("Please add a valid email.");
  if (message.length < 10) return U.bad("Please describe what you need in a little more detail.");

  const ref = `TKT-${U.hex(3).toUpperCase()}`;
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        "INSERT INTO tickets (id, ref, order_ref, name, email, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)"
      )
      .bind(U.hex(8), ref, U.clean(body.orderRef, 40), name, email, subject, message, now, now),
    db
      .prepare("INSERT INTO ticket_messages (id, ticket_ref, author, body, created_at) VALUES (?, ?, 'customer', ?, ?)")
      .bind(U.hex(8), ref, message, now),
  ]);
  return U.json({ ok: true, ref });
}

async function getTicket(env, ref, url) {
  const db = env.DB;
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const ticket = await db.prepare("SELECT * FROM tickets WHERE ref = ?").bind(ref).first();
  if (!ticket) return U.bad("Ticket not found", 404);
  if (!email || email !== String(ticket.email).toLowerCase()) return U.bad("Email does not match this ticket.", 403);
  const messages = await db
    .prepare("SELECT author, body, created_at FROM ticket_messages WHERE ticket_ref = ? ORDER BY created_at ASC")
    .bind(ref)
    .all();
  return U.json({ ticket, messages: messages.results || [] });
}

async function replyTicket(env, ref, request) {
  const db = env.DB;
  const body = await readJson(request);
  const email = U.clean(body.email, 160).toLowerCase();
  const text = U.clean(body.body, 4000);
  const ticket = await db.prepare("SELECT * FROM tickets WHERE ref = ?").bind(ref).first();
  if (!ticket) return U.bad("Ticket not found", 404);
  if (email !== String(ticket.email).toLowerCase()) return U.bad("Email does not match this ticket.", 403);
  if (text.length < 2) return U.bad("Write a message first.");
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare("INSERT INTO ticket_messages (id, ticket_ref, author, body, created_at) VALUES (?, ?, 'customer', ?, ?)")
      .bind(U.hex(8), ref, text, now),
    db.prepare("UPDATE tickets SET status = 'open', updated_at = ? WHERE ref = ?").bind(now, ref),
  ]);
  return U.json({ ok: true });
}

async function createRequest(env, request) {
  const db = env.DB;
  const body = await readJson(request);
  const name = U.oneLine(body.name, 80);
  const email = U.clean(body.email, 160).toLowerCase();
  const topic = U.oneLine(body.topic, 160);
  const message = U.clean(body.message, 4000);
  if (name.length < 2) return U.bad("Please add your name.");
  if (!U.isEmail(email)) return U.bad("Please add a valid email.");
  if (message.length < 10) return U.bad("Tell us what you actually want to learn.");
  await db
    .prepare(
      "INSERT INTO requests (id, name, email, whatsapp, topic, message, budget, status, admin_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', '', ?)"
    )
    .bind(
      U.hex(8), name, email, U.clean(body.whatsapp, 30), topic, message,
      U.clean(body.budget, 60), new Date().toISOString()
    )
    .run();
  return U.json({ ok: true });
}

async function createRefund(env, request) {
  const db = env.DB;
  const body = await readJson(request);
  const orderRef = U.clean(body.orderRef, 40).toUpperCase();
  const email = U.clean(body.email, 160).toLowerCase();
  const reason = U.clean(body.reason, 2000);
  const preference = U.clean(body.preference, 20) || "refund";
  if (reason.length < 10) return U.bad("Please tell us what didn't work for you.");

  const order = await db.prepare("SELECT * FROM orders WHERE UPPER(ref) = ?").bind(orderRef).first();
  if (!order) return U.bad("We could not find that order.", 404);
  if (String(order.email).toLowerCase() !== email) return U.bad("Email does not match this order.", 403);
  if (order.status !== "paid") return U.bad("Only paid orders can be reviewed for a refund.");

  const existing = await db.prepare("SELECT * FROM refunds WHERE order_ref = ?").bind(order.ref).first();
  if (existing) return U.json({ ok: true, ref: existing.ref, status: existing.status });

  const ref = `RFR-${U.hex(3).toUpperCase()}`;
  await db
    .prepare(
      "INSERT INTO refunds (id, ref, order_ref, name, email, reason, status, admin_note, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, 'requested', '', ?, '')"
    )
    .bind(U.hex(8), ref, order.ref, order.name, order.email, `[Preference: ${preference}] ${reason}`, new Date().toISOString())
    .run();
  await logEvent(db, order.ref, "refund_requested", reason.slice(0, 140));
  return U.json({ ok: true, ref });
}

/* -------------------------------- resell --------------------------------- */

async function activateReseller(db, order) {
  const existing = await db.prepare("SELECT * FROM resellers WHERE order_ref = ?").bind(order.ref).first();
  const now = new Date();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (existing) {
    await db
      .prepare("UPDATE resellers SET status = 'active', starts_at = ?, expires_at = ? WHERE id = ?")
      .bind(now.toISOString(), expires.toISOString(), existing.id)
      .run();
    return;
  }
  const meta = safeJson(order.meta, {});
  let code = `DIVA-${U.hex(2).toUpperCase()}`;
  const clash = await db.prepare("SELECT 1 AS x FROM resellers WHERE code = ?").bind(code).first();
  if (clash) code = `DIVA-${U.hex(3).toUpperCase()}`;
  await db
    .prepare(
      `INSERT INTO resellers (id, ref, order_ref, name, email, phone, instagram, code, status, starts_at, expires_at, clicks, sales, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, 0, ?)`
    )
    .bind(
      U.hex(8), `RSL-${U.hex(3).toUpperCase()}`, order.ref, order.name, order.email, order.phone,
      meta.instagram || "", code, now.toISOString(), expires.toISOString(), now.toISOString()
    )
    .run();
}

async function resellerLookup(env, request) {
  const db = env.DB;
  const body = await readJson(request);
  const code = U.clean(body.code, 24).toUpperCase();
  const email = U.clean(body.email, 160).toLowerCase();
  const reseller = await db.prepare("SELECT * FROM resellers WHERE UPPER(code) = ?").bind(code).first();
  if (!reseller || String(reseller.email).toLowerCase() !== email) {
    return U.bad("Code and email do not match an active licence.", 403);
  }
  const expired = reseller.expires_at ? new Date(reseller.expires_at) < new Date() : true;
  if (reseller.status !== "active" || expired) {
    return U.json({ status: expired ? "expired" : reseller.status, reseller, ebooks: [] });
  }
  const ebooks = await db
    .prepare("SELECT id, title, subtitle, cover, pages, file_name FROM ebooks WHERE status = 'active' ORDER BY sort")
    .all();
  return U.json({
    status: "active",
    reseller,
    ebooks: (ebooks.results || []).map((e) => ({
      ...e,
      downloadUrl: `/api/reseller/download/${encodeURIComponent(reseller.code)}?email=${encodeURIComponent(email)}&ebook=${e.id}`,
    })),
  });
}

async function resellerDownload(env, code, url) {
  const db = env.DB;
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const ebookId = url.searchParams.get("ebook") || "";
  const reseller = await db.prepare("SELECT * FROM resellers WHERE UPPER(code) = ?").bind(code.toUpperCase()).first();
  if (!reseller || String(reseller.email).toLowerCase() !== email) return U.bad("Licence not found.", 403);
  if (reseller.status !== "active" || new Date(reseller.expires_at) < new Date()) {
    return U.bad("This resell licence has expired.", 403);
  }
  const ebook = await db.prepare("SELECT * FROM ebooks WHERE id = ? AND status = 'active'").bind(ebookId).first();
  if (!ebook) return U.bad("Ebook not found.", 404);
  if (!ebook.file_key || ebook.file_key.startsWith("demo:") || !env.FILES) {
    const placeholder = U.demoPdf(
      ebook.title,
      "Neverbasic Diva · resell copy preview",
      ["Admin: upload the real PDF from Ebooks & PDFs to replace this preview for buyers and resellers."]
    );
    return new Response(placeholder, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${(ebook.file_name || "ebook.pdf").replace(/[^\w.\-]+/g, "-")}"`,
      },
    });
  }
  const object = await env.FILES.get(ebook.file_key);
  if (!object) return U.bad("File missing.", 404);
  await db.prepare("UPDATE resellers SET sales = sales WHERE id = ?").bind(reseller.id).run();
  return new Response(object.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${(ebook.file_name || "ebook.pdf").replace(/[^\w.\-]+/g, "-")}"`,
      "cache-control": "no-store",
    },
  });
}

/* -------------------------------- admin ---------------------------------- */

const attempts = new Map();

async function requireAdmin(request, env) {
  const token = U.parseCookies(request)[ADMIN_COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT s.token, s.expires_at, a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token = ?"
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: row.id, email: row.email, token: row.token };
}

async function adminSetup(env, request) {
  const db = env.DB;
  const count = await db.prepare("SELECT COUNT(*) AS n FROM admins").first();
  if (count && count.n) return U.bad("Admin already exists. Please sign in.", 409);
  const body = await readJson(request);
  const email = U.clean(body.email, 160).toLowerCase();
  const password = String(body.password || "");
  if (!U.isEmail(email)) return U.bad("Enter a valid admin email.");
  if (password.length < 8) return U.bad("Use a password with at least 8 characters.");
  const id = await createAdmin(db, email, password);
  const token = U.hex(24);
  await db
    .prepare("INSERT INTO sessions (token, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, id, new Date().toISOString(), new Date(Date.now() + 7 * 864e5).toISOString())
    .run();
  return U.json({ ok: true, admin: { email } }, 200, {
    "set-cookie": U.sessionCookie(ADMIN_COOKIE, token, { secure: new URL(request.url).protocol === "https:" }),
  });
}

async function adminLogin(env, request) {
  const db = env.DB;
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, at: now };
  if (now - record.at > 10 * 60 * 1000) {
    record.count = 0;
    record.at = now;
  }
  if (record.count >= 8) return U.bad("Too many attempts. Try again in 10 minutes.", 429);

  const body = await readJson(request);
  const email = U.clean(body.email, 160).toLowerCase();
  const password = String(body.password || "");
  const admin = await db.prepare("SELECT * FROM admins WHERE LOWER(email) = ?").bind(email).first();
  const ok = admin ? await U.verifyPassword(password, admin.salt, admin.pass_hash) : false;
  if (!ok) {
    record.count += 1;
    attempts.set(ip, record);
    return U.bad("Email or password is incorrect.", 401);
  }
  attempts.delete(ip);
  const token = U.hex(24);
  await db
    .prepare("INSERT INTO sessions (token, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, admin.id, new Date().toISOString(), new Date(Date.now() + 7 * 864e5).toISOString())
    .run();
  return U.json({ ok: true, admin: { email: admin.email } }, 200, {
    "set-cookie": U.sessionCookie(ADMIN_COOKIE, token, { secure: new URL(request.url).protocol === "https:" }),
  });
}

async function handleAdmin(request, env, url, admin) {
  const db = env.DB;
  const path = url.pathname.replace(/^\/api\/admin/, "");
  const method = request.method.toUpperCase();

  if (path === "/data" && method === "GET") {
    const [settings, ebooks, orders, tickets, requests, refunds, resellers, testimonials, stats] = await Promise.all([
      getSettings(db),
      db.prepare("SELECT * FROM ebooks ORDER BY sort ASC, created_at DESC").all(),
      db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 300").all(),
      db.prepare("SELECT * FROM tickets ORDER BY updated_at DESC LIMIT 200").all(),
      db.prepare("SELECT * FROM requests ORDER BY created_at DESC LIMIT 200").all(),
      db.prepare("SELECT * FROM refunds ORDER BY created_at DESC LIMIT 200").all(),
      db.prepare("SELECT * FROM resellers ORDER BY created_at DESC LIMIT 200").all(),
      db.prepare("SELECT * FROM testimonials ORDER BY sort ASC").all(),
      buildStats(db),
    ]);
    return U.json({
      admin: { email: admin.email },
      settings,
      ebooks: ebooks.results || [],
      orders: orders.results || [],
      tickets: tickets.results || [],
      requests: requests.results || [],
      refunds: refunds.results || [],
      resellers: resellers.results || [],
      testimonials: testimonials.results || [],
      stats,
    });
  }

  if (path === "/password" && method === "POST") {
    const body = await readJson(request);
    const current = String(body.current || "");
    const next = String(body.next || "");
    if (next.length < 8) return U.bad("New password needs at least 8 characters.");
    const row = await db.prepare("SELECT * FROM admins WHERE id = ?").bind(admin.id).first();
    if (!(await U.verifyPassword(current, row.salt, row.pass_hash))) return U.bad("Current password is wrong.");
    const fresh = await U.hashPassword(next);
    await db
      .prepare("UPDATE admins SET pass_hash = ?, salt = ? WHERE id = ?")
      .bind(fresh.hash, fresh.salt, admin.id)
      .run();
    return U.json({ ok: true });
  }

  if (path === "/settings" && method === "POST") {
    const body = await readJson(request);
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const updates = [];
    for (const [key, value] of Object.entries(body)) {
      if (allowed.includes(key)) updates.push(setSetting(db, key, value));
    }
    await Promise.all(updates);
    return U.json({ ok: true });
  }

  if (path === "/upload" && method === "POST") {
    if (!env.FILES) return U.bad("File storage is not available. Add the FILES (R2) binding and redeploy.", 503);
    const form = await request.formData();
    const kind = String(form.get("kind") || "cover");
    const file = form.get("file");
    if (!file || typeof file === "string") return U.bad("No file received.");
    const maxBytes = kind === "file" ? 25 * 1024 * 1024 : 6 * 1024 * 1024;
    if (file.size > maxBytes) return U.bad(`File is too big. Limit is ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    const original = String(file.name || "upload");
    const ext = (original.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const folder = kind === "file" ? "pdf" : "covers";
    const key = `${folder}/${U.hex(8)}-${U.slugify(original.replace(/\.[^.]+$/, ""))}.${ext || (kind === "file" ? "pdf" : "jpg")}`;
    const contentType = file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg");
    await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType } });
    return U.json({
      ok: true,
      key,
      url: kind === "file" ? "" : `/api/media/${key}`,
      name: original,
      size: file.size,
      contentType,
    });
  }

  if (path === "/ebooks" && method === "POST") {
    const body = await readJson(request);
    const title = U.oneLine(body.title, 140);
    if (title.length < 3) return U.bad("Give the ebook a title.");
    const price = U.toInt(body.price, 0);
    if (price < 0) return U.bad("Price cannot be negative.");
    const highlights = JSON.stringify(
      String(body.highlights || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10)
    );
    const id = U.clean(body.id, 40);
    const common = {
      title,
      subtitle: U.oneLine(body.subtitle, 200),
      description: U.clean(body.description, 4000),
      highlights,
      category: U.oneLine(body.category, 40) || "Mindset",
      pages: U.toInt(body.pages, 0),
      price,
      mrp: U.toInt(body.mrp, 0),
      cover: U.clean(body.cover, 400),
      file_key: U.clean(body.file_key, 400),
      file_name: U.clean(body.file_name, 200),
      file_size: U.toInt(body.file_size, 0),
      status: body.status === "draft" ? "draft" : "active",
      featured: body.featured ? 1 : 0,
      badge: U.oneLine(body.badge, 40),
      sort: U.toInt(body.sort, 0),
    };
    if (id) {
      const existing = await db.prepare("SELECT * FROM ebooks WHERE id = ?").bind(id).first();
      if (!existing) return U.bad("Ebook not found", 404);
      const slug = U.slugify(body.slug || common.title) + (existing.slug && U.slugify(body.slug || common.title) !== existing.slug ? "" : "");
      await db
        .prepare(
          `UPDATE ebooks SET slug=?, title=?, subtitle=?, description=?, highlights=?, category=?, pages=?, price=?, mrp=?, cover=?, file_key=?, file_name=?, file_size=?, status=?, featured=?, badge=?, sort=? WHERE id=?`
        )
        .bind(
          slug, common.title, common.subtitle, common.description, common.highlights, common.category,
          common.pages, common.price, common.mrp, common.cover, common.file_key || existing.file_key,
          common.file_name || existing.file_name, common.file_size || existing.file_size, common.status,
          common.featured, common.badge, common.sort, id
        )
        .run();
      return U.json({ ok: true, id });
    }
    const newId = U.hex(8);
    let slug = U.slugify(common.title);
    const clash = await db.prepare("SELECT 1 AS x FROM ebooks WHERE slug = ?").bind(slug).first();
    if (clash) slug = `${slug}-${U.hex(2)}`;
    await db
      .prepare(
        `INSERT INTO ebooks (id, slug, title, subtitle, description, highlights, category, pages, price, mrp, cover, file_key, file_name, file_size, status, featured, badge, sort, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId, slug, common.title, common.subtitle, common.description, common.highlights, common.category,
        common.pages, common.price, common.mrp, common.cover, common.file_key, common.file_name,
        common.file_size, common.status, common.featured, common.badge, common.sort, new Date().toISOString()
      )
      .run();
    return U.json({ ok: true, id: newId });
  }

  let m = path.match(/^\/ebooks\/([^/]+)\/delete$/);
  if (m && method === "POST") {
    await db.prepare("DELETE FROM ebooks WHERE id = ?").bind(decodeURIComponent(m[1])).run();
    return U.json({ ok: true });
  }

  m = path.match(/^\/ebooks\/([^/]+)\/download$/);
  if (m && method === "GET") {
    const ebook = await db.prepare("SELECT * FROM ebooks WHERE id = ?").bind(decodeURIComponent(m[1])).first();
    if (!ebook || !ebook.file_key || !env.FILES) return U.bad("No file uploaded for this ebook.", 404);
    const object = await env.FILES.get(ebook.file_key);
    if (!object) return U.bad("No file uploaded for this ebook.", 404);
    return new Response(object.body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${(ebook.file_name || "ebook.pdf").replace(/[^\w.\-]+/g, "-")}"`,
      },
    });
  }

  m = path.match(/^\/orders\/([^/]+)$/);
  if (m && method === "POST") {
    const ref = decodeURIComponent(m[1]);
    const body = await readJson(request);
    const action = U.clean(body.action, 30);
    const order = await db.prepare("SELECT * FROM orders WHERE ref = ?").bind(ref).first();
    if (!order) return U.bad("Order not found", 404);
    if (action === "mark_paid") {
      await markOrderPaid(db, ref, {
        txnid: U.clean(body.txnid, 60),
        mode: order.payment_mode || "manual",
        note: `Marked paid by admin${body.txnid ? ` · ${U.clean(body.txnid, 60)}` : ""}`,
      });
      return U.json({ ok: true });
    }
    if (action === "refund") {
      await db
        .prepare("UPDATE orders SET status = 'refunded', notes = ? WHERE ref = ?")
        .bind(`Refunded by admin${body.note ? ` · ${U.clean(body.note, 200)}` : ""}`, ref)
        .run();
      await db
        .prepare("UPDATE refunds SET status = 'approved', resolved_at = ? WHERE order_ref = ? AND status != 'rejected'")
        .bind(new Date().toISOString(), ref)
        .run();
      await logEvent(db, ref, "refunded", "Refund issued by admin");
      return U.json({ ok: true });
    }
    if (action === "cancel") {
      await db.prepare("UPDATE orders SET status = 'cancelled' WHERE ref = ?").bind(ref).run();
      await logEvent(db, ref, "cancelled", "Order cancelled by admin");
      return U.json({ ok: true });
    }
    if (action === "note") {
      await db.prepare("UPDATE orders SET notes = ? WHERE ref = ?").bind(U.clean(body.note, 300), ref).run();
      await logEvent(db, ref, "note", U.clean(body.note, 300));
      return U.json({ ok: true });
    }
    if (action === "resend") {
      const token = order.download_token || U.hex(12);
      await db.prepare("UPDATE orders SET download_token = ? WHERE ref = ?").bind(token, ref).run();
      await logEvent(db, ref, "link_refreshed", "Access link refreshed by admin");
      return U.json({ ok: true, downloadUrl: `/api/download/${token}` });
    }
    return U.bad("Unknown action");
  }

  m = path.match(/^\/tickets\/([^/]+)$/);
  if (m && method === "GET") {
    const ref = decodeURIComponent(m[1]);
    const ticket = await db.prepare("SELECT * FROM tickets WHERE ref = ?").bind(ref).first();
    if (!ticket) return U.bad("Ticket not found", 404);
    const messages = await db
      .prepare("SELECT * FROM ticket_messages WHERE ticket_ref = ? ORDER BY created_at ASC")
      .bind(ref)
      .all();
    return U.json({ ticket, messages: messages.results || [] });
  }
  m = path.match(/^\/tickets\/([^/]+)\/reply$/);
  if (m && method === "POST") {
    const ref = decodeURIComponent(m[1]);
    const body = await readJson(request);
    const text = U.clean(body.body, 4000);
    if (text.length < 2) return U.bad("Write a reply first.");
    const status = body.status === "closed" ? "closed" : "answered";
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare("INSERT INTO ticket_messages (id, ticket_ref, author, body, created_at) VALUES (?, ?, 'admin', ?, ?)")
        .bind(U.hex(8), ref, text, now),
      db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE ref = ?").bind(status, now, ref),
    ]);
    return U.json({ ok: true });
  }

  m = path.match(/^\/requests\/([^/]+)$/);
  if (m && method === "POST") {
    const body = await readJson(request);
    await db
      .prepare("UPDATE requests SET status = ?, admin_note = ? WHERE id = ?")
      .bind(U.clean(body.status, 20) || "new", U.clean(body.admin_note, 500), decodeURIComponent(m[1]))
      .run();
    return U.json({ ok: true });
  }

  m = path.match(/^\/refunds\/([^/]+)$/);
  if (m && method === "POST") {
    const ref = decodeURIComponent(m[1]);
    const body = await readJson(request);
    const action = U.clean(body.action, 20);
    const refund = await db.prepare("SELECT * FROM refunds WHERE ref = ?").bind(ref).first();
    if (!refund) return U.bad("Refund request not found", 404);
    if (action === "approve") {
      await db.batch([
        db
          .prepare("UPDATE refunds SET status = 'approved', admin_note = ?, resolved_at = ? WHERE ref = ?")
          .bind(U.clean(body.note, 500), new Date().toISOString(), ref),
        db.prepare("UPDATE orders SET status = 'refunded' WHERE ref = ?").bind(refund.order_ref),
      ]);
      await logEvent(db, refund.order_ref, "refunded", "Refund approved by admin");
    } else if (action === "reject") {
      await db
        .prepare("UPDATE refunds SET status = 'rejected', admin_note = ?, resolved_at = ? WHERE ref = ?")
        .bind(U.clean(body.note, 500), new Date().toISOString(), ref)
        .run();
      await logEvent(db, refund.order_ref, "refund_rejected", U.clean(body.note, 200));
    } else if (action === "material") {
      await db
        .prepare("UPDATE refunds SET status = 'material_sent', admin_note = ? WHERE ref = ?")
        .bind(U.clean(body.note, 500), ref)
        .run();
      await logEvent(db, refund.order_ref, "material_sent", "Replacement material sent by admin");
    }
    return U.json({ ok: true });
  }

  m = path.match(/^\/resellers\/([^/]+)$/);
  if (m && method === "POST") {
    const ref = decodeURIComponent(m[1]);
    const body = await readJson(request);
    const action = U.clean(body.action, 20);
    const reseller = await db.prepare("SELECT * FROM resellers WHERE ref = ?").bind(ref).first();
    if (!reseller) return U.bad("Reseller not found", 404);
    const now = new Date();
    if (action === "activate") {
      const start = reseller.starts_at ? new Date(reseller.starts_at) : now;
      await db
        .prepare("UPDATE resellers SET status = 'active', starts_at = ?, expires_at = ? WHERE ref = ?")
        .bind(start.toISOString(), new Date(start.getTime() + 365 * 864e5).toISOString(), ref)
        .run();
    } else if (action === "revoke") {
      await db.prepare("UPDATE resellers SET status = 'revoked' WHERE ref = ?").bind(ref).run();
    } else if (action === "extend") {
      const base = reseller.expires_at && new Date(reseller.expires_at) > now ? new Date(reseller.expires_at) : now;
      await db
        .prepare("UPDATE resellers SET status = 'active', expires_at = ? WHERE ref = ?")
        .bind(new Date(base.getTime() + 365 * 864e5).toISOString(), ref)
        .run();
    }
    return U.json({ ok: true });
  }

  if (path === "/testimonials" && method === "POST") {
    const body = await readJson(request);
    const id = U.clean(body.id, 40);
    const values = [
      U.oneLine(body.name, 60) || "Reader",
      U.oneLine(body.handle, 60),
      U.clean(body.body, 500),
      Math.min(5, Math.max(1, U.toInt(body.rating, 5))),
      body.status === "hidden" ? "hidden" : "active",
      U.toInt(body.sort, 0),
    ];
    if (!values[2]) return U.bad("Testimonial text is required.");
    if (id) {
      await db
        .prepare("UPDATE testimonials SET name=?, handle=?, body=?, rating=?, status=?, sort=? WHERE id=?")
        .bind(...values, id)
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO testimonials (id, name, handle, body, rating, status, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(U.hex(8), ...values, new Date().toISOString())
        .run();
    }
    return U.json({ ok: true });
  }
  m = path.match(/^\/testimonials\/([^/]+)\/delete$/);
  if (m && method === "POST") {
    await db.prepare("DELETE FROM testimonials WHERE id = ?").bind(decodeURIComponent(m[1])).run();
    return U.json({ ok: true });
  }

  if (path === "/export/orders.csv" && method === "GET") {
    const rows = await db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    const header = ["ref", "created_at", "name", "email", "phone", "item", "amount", "status", "mode", "utr", "payu_txnid", "downloads", "paid_at"];
    const lines = [header.join(",")];
    for (const row of rows.results || []) {
      lines.push(
        [row.ref, row.created_at, row.name, row.email, row.phone, row.item_title, row.amount, row.status, row.payment_mode, row.utr, row.payu_txnid, row.downloads, row.paid_at]
          .map(U.csvCell)
          .join(",")
      );
    }
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="neverbasic-diva-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  return U.bad("Not found", 404);
}

async function buildStats(db) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const one = (sql, ...bind) => db.prepare(sql).bind(...bind).first();
  const all = (sql, ...bind) => db.prepare(sql).bind(...bind).all();

  const [paid, pending, revenueToday, visits, downloads, activeResellers, openTickets, openRefunds, newRequests] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'"),
    one("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
    one("SELECT COALESCE(SUM(amount), 0) AS n FROM orders WHERE status = 'paid' AND substr(paid_at, 1, 10) = ?", today),
    one("SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE day >= ?", weekAgo),
    one("SELECT COALESCE(SUM(downloads), 0) AS n FROM orders"),
    one("SELECT COUNT(*) AS n FROM resellers WHERE status = 'active' AND expires_at > ?", new Date().toISOString()),
    one("SELECT COUNT(*) AS n FROM tickets WHERE status = 'open'"),
    one("SELECT COUNT(*) AS n FROM refunds WHERE status = 'requested'"),
    one("SELECT COUNT(*) AS n FROM requests WHERE status = 'new'"),
  ]);
  const revenue = await one("SELECT COALESCE(SUM(amount), 0) AS n FROM orders WHERE status = 'paid'");
  const series = await all(
    "SELECT substr(paid_at, 1, 10) AS day, COUNT(*) AS orders, SUM(amount) AS revenue FROM orders WHERE status = 'paid' GROUP BY day ORDER BY day DESC LIMIT 14"
  );
  const top = await all(
    "SELECT item_title, COUNT(*) AS orders, SUM(amount) AS revenue FROM orders WHERE status = 'paid' GROUP BY item_title ORDER BY orders DESC LIMIT 5"
  );
  const funnel = await all("SELECT status, COUNT(*) AS n FROM orders GROUP BY status");
  return {
    revenue: revenue ? revenue.n : 0,
    paidOrders: paid ? paid.n : 0,
    pendingOrders: pending ? pending.n : 0,
    revenueToday: revenueToday ? revenueToday.n : 0,
    visitsWeek: visits ? visits.n : 0,
    downloads: downloads ? downloads.n : 0,
    activeResellers: activeResellers ? activeResellers.n : 0,
    openTickets: openTickets ? openTickets.n : 0,
    openRefunds: openRefunds ? openRefunds.n : 0,
    newRequests: newRequests ? newRequests.n : 0,
    series: (series.results || []).reverse(),
    top: top.results || [],
    funnel: funnel.results || [],
  };
}

async function readJson(request) {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}
