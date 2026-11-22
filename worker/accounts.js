// Customer accounts: email + password (PBKDF2, hashed server-side), optional
// Firebase email/password sign-in, and a private data view of everything the
// buyer has ever done on the store.
import { getSettings } from "./db.js";
import * as U from "./util.js";

const CUSTOMER_COOKIE = "nbd_customer";
const SESSION_DAYS = 30;
const attempts = new Map();

const ipOf = (request) =>
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("x-nf-client-connection-ip") ||
  (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  "local";

function parseJson(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    email: row.email,
    phone: row.phone || "",
    country: row.country || "",
    firebase: Boolean(row.firebase_uid),
    passwordSet: Boolean(row.pass_hash),
    created_at: row.created_at,
  };
}

export async function customerFromRequest(env, request) {
  const token = U.parseCookies(request)[CUSTOMER_COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT s.token, s.expires_at, c.* FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token = ?"
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

async function issueSession(db, customerId, request) {
  const token = U.hex(24);
  const now = new Date();
  await db.prepare("DELETE FROM customer_sessions WHERE expires_at < ?").bind(now.toISOString()).run();
  await db
    .prepare("INSERT INTO customer_sessions (token, customer_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, customerId, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * 864e5).toISOString())
    .run();
  await db.prepare("UPDATE customers SET last_login_at = ? WHERE id = ?").bind(now.toISOString(), customerId).run();
  return U.sessionCookie(CUSTOMER_COOKIE, token, {
    maxAge: SESSION_DAYS * 86400,
    secure: new URL(request.url).protocol === "https:",
  });
}

async function linkOrders(db, customer) {
  try {
    await db
      .prepare("UPDATE orders SET customer_id = ? WHERE LOWER(email) = ? AND (customer_id = '' OR customer_id IS NULL)")
      .bind(customer.id, String(customer.email).toLowerCase())
      .run();
  } catch {
    /* linking is best-effort */
  }
}

async function customerData(db, customer) {
  const email = String(customer.email).toLowerCase();
  const [orders, tickets, requests, refunds, resellers] = await Promise.all([
    db
      .prepare("SELECT * FROM orders WHERE LOWER(email) = ? OR customer_id = ? ORDER BY created_at DESC LIMIT 100")
      .bind(email, customer.id)
      .all(),
    db.prepare("SELECT ref, subject, status, created_at, updated_at FROM tickets WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 50").bind(email).all(),
    db.prepare("SELECT id, topic, message, budget, status, admin_note, created_at FROM requests WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 50").bind(email).all(),
    db.prepare("SELECT ref, order_ref, status, created_at FROM refunds WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 50").bind(email).all(),
    db.prepare("SELECT code, status, expires_at, sales, clicks FROM resellers WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 10").bind(email).all(),
  ]);

  // Replies live on the account page too, not only in the email thread.
  const ticketRows = tickets.results || [];
  let ticketMessages = [];
  if (ticketRows.length) {
    const marks = ticketRows.map(() => "?").join(",");
    const messageRows = await db
      .prepare(
        `SELECT ticket_ref, author, body, created_at FROM ticket_messages WHERE ticket_ref IN (${marks}) ORDER BY created_at ASC`
      )
      .bind(...ticketRows.map((row) => row.ref))
      .all();
    ticketMessages = messageRows.results || [];
  }
  const threads = ticketRows.map((row) => ({
    ...row,
    messages: ticketMessages.filter((message) => message.ticket_ref === row.ref),
  }));

  const rows = orders.results || [];
  // Attach the downloadable items for every paid order.
  const ebookRows = await db.prepare("SELECT id, title, cover, pages, file_name FROM ebooks").all();
  const ebookMap = Object.fromEntries((ebookRows.results || []).map((row) => [row.id, row]));
  let spent = 0;
  const list = rows.map((order) => {
    const meta = parseJson(order.meta, {});
    const ids =
      Array.isArray(meta.ebookIds) && meta.ebookIds.length ? meta.ebookIds : order.ebook_id ? [order.ebook_id] : [];
    if (order.status === "paid") spent += Number(order.amount) || 0;
    return {
      ref: order.ref,
      kind: order.kind,
      itemTitle: order.item_title,
      title: order.item_title,
      amount: order.amount,
      amountCharged: Number(order.amount_charged) || Number(order.amount) || 0,
      currency: order.currency || "INR",
      status: order.status,
      paymentMode: order.payment_mode,
      paid_at: order.paid_at,
      created_at: order.created_at,
      downloads: order.downloads,
      items:
        order.status === "paid"
          ? ids
              .map((id) => ebookMap[id])
              .filter(Boolean)
              .map((ebook) => ({
                id: ebook.id,
                title: ebook.title,
                cover: ebook.cover,
                pages: ebook.pages,
                downloadUrl: `/api/download/${order.download_token}?item=${encodeURIComponent(ebook.id)}`,
              }))
          : [],
      downloadUrl: order.status === "paid" ? `/api/download/${order.download_token}` : "",
      receiptUrl:
        order.status === "paid"
          ? `/api/receipt/${encodeURIComponent(order.ref)}?email=${encodeURIComponent(order.email)}`
          : "",
    };
  });

  return {
    orders: list,
    tickets: threads,
    requests: requests.results || [],
    refunds: refunds.results || [],
    resellers: resellers.results || [],
    summary: {
      orders: list.length,
      paid: list.filter((order) => order.status === "paid").length,
      spent,
      downloads: list.reduce((total, order) => total + (Number(order.downloads) || 0), 0),
    },
  };
}

function passwordProblem(password) {
  const value = String(password || "");
  if (value.length < 8) return "Use a password with at least 8 characters.";
  if (value.length > 200) return "That password is too long.";
  return "";
}

async function findCustomerByEmail(db, email) {
  return db.prepare("SELECT * FROM customers WHERE LOWER(email) = ?").bind(String(email).toLowerCase()).first();
}

/* ------------------------------- Firebase -------------------------------- */

// The Firebase project id is needed by the browser SDK. Admin normally saves it;
// when it is blank we ask Firebase for it with the public web API key (the same
// call the Firebase SDK makes), and remember the answer for this isolate.
let projectLookup = { key: "", projectId: "" };
async function firebaseProjectId(settings, env) {
  const configured = String(settings.firebase_project_id || env.FIREBASE_PROJECT_ID || "").trim();
  if (configured) return configured;
  const key = String(settings.firebase_api_key || env.FIREBASE_API_KEY || "").trim();
  if (!key) return "";
  if (projectLookup.key === key) return projectLookup.projectId;
  try {
    const response = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(key)}`
    );
    const data = await response.json().catch(() => ({}));
    const projectId = String(data.projectId || "").trim();
    projectLookup = { key, projectId };
    return projectId;
  } catch {
    projectLookup = { key, projectId: "" };
    return "";
  }
}

async function firebaseIdentity(settings, env, idToken) {
  const key = String(settings.firebase_api_key || env.FIREBASE_API_KEY || "").trim();
  if (!key) return { error: "Firebase sign-in is not configured yet." };
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.users || !data.users.length) {
    return { error: "That Firebase session could not be verified. Sign in again." };
  }
  const user = data.users[0];
  if (!user.email) return { error: "That Firebase account has no email address." };
  return { uid: user.localId, email: String(user.email).toLowerCase(), name: user.displayName || "" };
}

/* -------------------------------- routes --------------------------------- */

export async function accountRoute(request, env, url) {
  const db = env.DB;
  const path = url.pathname.replace(/^\/api\/account/, "");
  const method = request.method.toUpperCase();
  const settings = await getSettings(db);

  if (settings.customer_accounts === "0" && path !== "/session") {
    return U.bad("Accounts are switched off right now.", 403);
  }

  if (path === "/session" && method === "GET") {
    const customer = await customerFromRequest(env, request);
    const firebaseKey = String(settings.firebase_api_key || env.FIREBASE_API_KEY || "").trim();
    const projectId = firebaseKey ? await firebaseProjectId(settings, env) : "";
    return U.json({
      ok: true,
      accounts: settings.customer_accounts !== "0",
      firebase: Boolean(firebaseKey),
      // A Firebase web API key is public by design (it ships in every web app).
      firebaseKey: firebaseKey || "",
      firebaseProjectId: projectId,
      firebaseAuthDomain: projectId ? `${projectId}.firebaseapp.com` : "",
      customer: safeCustomer(customer),
    });
  }

  if (path === "/signup" && method === "POST") {
    const ip = ipOf(request);
    if (!rateLimit(ip, 8, 60 * 60 * 1000)) return U.bad("Too many sign-up attempts. Try again later.", 429);
    const body = await readJson(request);
    const name = U.oneLine(body.name, 80);
    const email = U.clean(body.email, 160).toLowerCase();
    const phone = U.clean(body.phone, 24);
    const password = String(body.password || "");
    if (name.length < 2) return U.bad("Please add your name.");
    if (!U.isEmail(email)) return U.bad("Please add a valid email.");
    const problem = passwordProblem(password);
    if (problem) return U.bad(problem);
    const existing = await findCustomerByEmail(db, email);
    if (existing) return U.bad("An account already exists with this email. Sign in instead.", 409);
    const { hash, salt } = await U.hashPassword(password);
    const id = U.hex(8);
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO customers (id, name, email, phone, country, pass_hash, salt, firebase_uid, status, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'active', ?, ?)"
      )
      .bind(id, name, email, phone, U.clean(body.country, 2).toUpperCase(), hash, salt, now, now)
      .run();
    const customer = await findCustomerByEmail(db, email);
    await linkOrders(db, { id, email });
    return U.json({ ok: true, customer: safeCustomer(customer) }, 200, {
      "set-cookie": await issueSession(db, id, request),
    });
  }

  if (path === "/login" && method === "POST") {
    const ip = ipOf(request);
    if (!rateLimit(`login:${ip}`, 12, 15 * 60 * 1000)) return U.bad("Too many attempts. Try again in a few minutes.", 429);
    const body = await readJson(request);
    const email = U.clean(body.email, 160).toLowerCase();
    const password = String(body.password || "");
    const customer = await findCustomerByEmail(db, email);
    const ok = customer && customer.pass_hash ? await U.verifyPassword(password, customer.salt, customer.pass_hash) : false;
    if (!ok) return U.bad("Email or password is incorrect.", 401);
    if (customer.status !== "active") return U.bad("This account is paused. Contact support.", 403);
    await linkOrders(db, customer);
    return U.json({ ok: true, customer: safeCustomer(customer) }, 200, {
      "set-cookie": await issueSession(db, customer.id, request),
    });
  }

  if (path === "/logout" && method === "POST") {
    const token = U.parseCookies(request)[CUSTOMER_COOKIE];
    if (token) await db.prepare("DELETE FROM customer_sessions WHERE token = ?").bind(token).run();
    return U.json({ ok: true }, 200, { "set-cookie": U.clearCookie(CUSTOMER_COOKIE) });
  }

  if (path === "/firebase" && method === "POST") {
    const body = await readJson(request);
    const idToken = String(body.idToken || "");
    if (!idToken) return U.bad("Missing Firebase token.");
    const identity = await firebaseIdentity(settings, env, idToken);
    if (identity.error) return U.bad(identity.error, 400);
    let customer = await findCustomerByEmail(db, identity.email);
    if (!customer) {
      const id = U.hex(8);
      const now = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO customers (id, name, email, phone, country, pass_hash, salt, firebase_uid, status, created_at, last_login_at) VALUES (?, ?, ?, '', '', '', '', ?, 'active', ?, ?)"
        )
        .bind(id, identity.name || identity.email.split("@")[0], identity.email, identity.uid, now, now)
        .run();
      customer = await findCustomerByEmail(db, identity.email);
    } else if (!customer.firebase_uid) {
      await db.prepare("UPDATE customers SET firebase_uid = ? WHERE id = ?").bind(identity.uid, customer.id).run();
    }
    await linkOrders(db, customer);
    return U.json({ ok: true, customer: safeCustomer(customer) }, 200, {
      "set-cookie": await issueSession(db, customer.id, request),
    });
  }

  const customer = await customerFromRequest(env, request);
  if (!customer) return U.bad("Please sign in to your account.", 401);

  if (path === "/data" && method === "GET") {
    const data = await customerData(db, customer);
    return U.json({ ok: true, customer: safeCustomer(customer), ...data });
  }

  if (path === "/profile" && method === "POST") {
    const body = await readJson(request);
    const name = U.oneLine(body.name, 80) || customer.name;
    const phone = U.clean(body.phone, 24);
    const country = U.clean(body.country, 2).toUpperCase();
    await db.prepare("UPDATE customers SET name = ?, phone = ?, country = ? WHERE id = ?").bind(name, phone, country, customer.id).run();
    const fresh = await db.prepare("SELECT * FROM customers WHERE id = ?").bind(customer.id).first();
    return U.json({ ok: true, customer: safeCustomer(fresh) });
  }

  if (path === "/password" && method === "POST") {
    const body = await readJson(request);
    const current = String(body.current || "");
    const next = String(body.next || "");
    const problem = passwordProblem(next);
    if (problem) return U.bad(problem);
    if (customer.pass_hash) {
      const ok = await U.verifyPassword(current, customer.salt, customer.pass_hash);
      if (!ok) return U.bad("Current password is wrong.", 403);
    }
    const { hash, salt } = await U.hashPassword(next);
    await db.prepare("UPDATE customers SET pass_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, customer.id).run();
    await db
      .prepare("DELETE FROM customer_sessions WHERE customer_id = ? AND token != ?")
      .bind(customer.id, U.parseCookies(request)[CUSTOMER_COOKIE] || "")
      .run();
    return U.json({ ok: true });
  }

  return U.bad("Not found", 404);
}

/* ------------------------------ tiny helpers ----------------------------- */

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.at > windowMs) {
    attempts.set(key, { count: 1, at: now });
    return true;
  }
  record.count += 1;
  return record.count <= max;
}

async function readJson(request) {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export { CUSTOMER_COOKIE };
