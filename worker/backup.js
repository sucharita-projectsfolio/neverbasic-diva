// Content safety vault.
//
// The store's real content lives in the database (D1 / Postgres) and uploaded
// files live in FILES (R2 / Netlify Blobs) — never in git. Code updates must
// therefore never be able to change a product, price, hero copy or image.
//
// This module adds the second layer:
//   • a daily automatic snapshot kept in private storage (latest + previous),
//   • a one-click export that also embeds uploaded cover/media images,
//   • a merge-only restore that adds or updates rows from a backup and NEVER
//     deletes a row that is not in it.
//
// The third layer is scripts/guard-content.mjs, which fails the build if a
// future change would delete protected images, change the storage bindings or
// add a destructive migration.

import { getSettings, setSetting } from "./db.js";

const VERSION = 1;
const AUTO_KEY = "backups/latest.json";
const PREVIOUS_KEY = "backups/previous.json";
const BEFORE_RESTORE_KEY = "backups/before-restore.json";
const AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_EXPORT_ASSET_BYTES = 40 * 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 6 * 1024 * 1024;
const MAX_ASSETS = 120;
const MAX_RESTORE_ROWS = 50000;
const CHUNK = 40;
const BACKUP_META_KEYS = new Set([
  "content_backup_at",
  "content_backup_counts",
  "content_backup_stored",
  "content_restore_at",
]);

// Whitelisted tables only. Column order is fixed here, never taken from the
// uploaded JSON, so a crafted backup cannot inject SQL.
const TABLES = {
  settings: {
    key: "key",
    policy: "overwrite",
    columns: ["key", "value"],
    label: "settings",
  },
  ebooks: {
    key: "id",
    policy: "overwrite",
    columns: [
      "id", "slug", "title", "subtitle", "description", "highlights", "category", "pages", "price",
      "mrp", "cover", "file_key", "file_name", "file_size", "status", "featured", "badge", "sort",
      "created_at", "ai_meta", "sample", "sample_enabled", "tags",
    ],
    label: "ebooks",
  },
  testimonials: {
    key: "id",
    policy: "overwrite",
    columns: ["id", "name", "handle", "body", "rating", "status", "sort", "created_at"],
    label: "testimonials",
  },
  reviews: {
    key: "id",
    policy: "overwrite",
    columns: ["id", "ebook_id", "order_ref", "name", "email", "rating", "body", "status", "source", "created_at"],
    label: "reviews",
  },
  bundles: {
    key: "id",
    policy: "overwrite",
    columns: ["id", "slug", "title", "subtitle", "ebook_ids", "price", "mrp", "badge", "cover", "status", "sort", "created_at"],
    label: "bundles",
  },
  posts: {
    key: "id",
    policy: "overwrite",
    columns: ["id", "slug", "title", "excerpt", "body", "cover", "status", "published_at", "created_at"],
    label: "journal posts",
  },
  coupons: {
    key: "id",
    policy: "overwrite",
    columns: ["id", "code", "kind", "value", "min_amount", "max_uses", "used", "expires_at", "status", "created_at"],
    label: "coupons",
  },
  subscribers: {
    key: "email",
    policy: "missing",
    columns: ["id", "email", "source", "status", "created_at"],
    label: "subscribers",
  },
  orders: {
    key: "ref",
    policy: "missing",
    columns: [
      "id", "ref", "kind", "ebook_id", "item_title", "name", "email", "phone", "amount", "amount_charged",
      "currency", "country", "status", "payment_mode", "utr", "payu_txnid", "payu_mode", "gateway_order_id",
      "download_token", "downloads", "reseller_code", "customer_id", "meta", "notes", "email_sent_at",
      "created_at", "paid_at", "meta_capi_at",
    ],
    label: "orders",
  },
  customers: {
    key: "email",
    policy: "missing",
    columns: [
      "id", "name", "email", "phone", "country", "pass_hash", "salt", "firebase_uid", "status",
      "created_at", "last_login_at",
    ],
    label: "customers",
  },
  resellers: {
    key: "ref",
    policy: "missing",
    columns: [
      "id", "ref", "order_ref", "name", "email", "phone", "instagram", "code", "status", "starts_at",
      "expires_at", "clicks", "sales", "created_at",
    ],
    label: "resellers",
  },
  requests: {
    key: "id",
    policy: "missing",
    columns: ["id", "name", "email", "whatsapp", "topic", "message", "budget", "status", "admin_note", "created_at"],
    label: "custom requests",
  },
  refunds: {
    key: "ref",
    policy: "missing",
    columns: ["id", "ref", "order_ref", "name", "email", "reason", "status", "admin_note", "created_at", "resolved_at"],
    label: "refund requests",
  },
  tickets: {
    key: "ref",
    policy: "missing",
    columns: ["id", "ref", "order_ref", "name", "email", "subject", "message", "status", "created_at", "updated_at"],
    label: "support tickets",
  },
  ticket_messages: {
    key: "id",
    policy: "missing",
    columns: ["id", "ticket_ref", "author", "body", "created_at"],
    label: "ticket replies",
  },
};

let lastAutoCheck = 0;

/* ------------------------------- utilities -------------------------------- */

const nowIso = () => new Date().toISOString();

function toBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(String(text || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function assetKeyFrom(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = /\/api\/media\/([A-Za-z0-9._/-]+)/.exec(text);
  if (match) return decodeURIComponent(match[1]);
  if (/^(covers|media)\/[A-Za-z0-9._/-]+$/.test(text)) return text;
  return "";
}

function collectAssetKeys(value, out = new Set()) {
  if (typeof value === "string") {
    const key = assetKeyFrom(value);
    if (key) out.add(key);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetKeys(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectAssetKeys(item, out);
  }
  return out;
}

async function readFileJson(env, key) {
  if (!env.FILES) return null;
  const object = await env.FILES.get(key);
  if (!object) return null;
  const text = await new Response(object.body).text();
  return { data: JSON.parse(text), httpMetadata: object.httpMetadata || {} };
}

async function writeFileJson(env, key, value) {
  if (!env.FILES) return false;
  await env.FILES.put(key, JSON.stringify(value), { httpMetadata: { contentType: "application/json" } });
  return true;
}

function cleanRow(table, row) {
  const out = {};
  for (const column of table.columns) {
    let value = row && row[column] !== undefined && row[column] !== null ? row[column] : "";
    if (typeof value === "object") value = JSON.stringify(value);
    else value = String(value);
    if (value.length > 200000) value = value.slice(0, 200000);
    out[column] = value;
  }
  return out;
}

function tableRows(snapshot, name) {
  const rows = snapshot && snapshot.tables && snapshot.tables[name];
  return Array.isArray(rows) ? rows : [];
}

/* ------------------------------- snapshot --------------------------------- */

export async function buildSnapshot(env) {
  const tables = {};
  const counts = {};
  for (const [name, table] of Object.entries(TABLES)) {
    try {
      const result = await env.DB.prepare(`SELECT ${table.columns.join(", ")} FROM ${name}`).all();
      const rows = (result.results || []).slice(0, MAX_RESTORE_ROWS);
      tables[name] = rows.map((row) => cleanRow(table, row));
      counts[name] = tables[name].length;
    } catch (error) {
      // A table added in a later release must not stop older stores from
      // taking a backup of everything else.
      tables[name] = [];
      counts[name] = 0;
    }
  }
  return {
    app: "neverbasic-diva",
    version: VERSION,
    kind: "content",
    created_at: nowIso(),
    counts,
    tables,
  };
}

async function collectAssets(env, snapshot) {
  if (!env.FILES) return { assets: {}, skipped: [] };
  const keys = new Set();
  collectAssetKeys(snapshot.tables, keys);
  const assets = {};
  const skipped = [];
  let total = 0;
  for (const key of [...keys].slice(0, MAX_ASSETS)) {
    if (!/^(covers|media)\//.test(key) || key.includes("..")) continue;
    try {
      const object = await env.FILES.get(key);
      if (!object) {
        skipped.push({ key, reason: "missing" });
        continue;
      }
      const buffer = await new Response(object.body).arrayBuffer();
      if (buffer.byteLength > MAX_SINGLE_ASSET_BYTES) {
        skipped.push({ key, reason: "too_large" });
        continue;
      }
      if (total + buffer.byteLength > MAX_EXPORT_ASSET_BYTES) {
        skipped.push({ key, reason: "export_limit" });
        continue;
      }
      total += buffer.byteLength;
      assets[key] = {
        type: (object.httpMetadata && object.httpMetadata.contentType) || "application/octet-stream",
        size: buffer.byteLength,
        data: toBase64(buffer),
      };
    } catch {
      skipped.push({ key, reason: "unreadable" });
    }
  }
  return { assets, skipped };
}

export async function exportBackup(env) {
  const snapshot = await buildSnapshot(env);
  const { assets, skipped } = await collectAssets(env, snapshot);
  return {
    ...snapshot,
    kind: "full",
    assets,
    assets_skipped: skipped,
  };
}

export async function createSnapshot(env, { reason = "manual" } = {}) {
  const snapshot = await buildSnapshot(env);
  snapshot.reason = reason;
  let stored = false;
  if (env.FILES) {
    const previous = await readFileJson(env, AUTO_KEY).catch(() => null);
    if (previous && previous.data) await writeFileJson(env, PREVIOUS_KEY, previous.data).catch(() => {});
    stored = await writeFileJson(env, AUTO_KEY, snapshot).catch(() => false);
  }
  await setSetting(env.DB, "content_backup_at", snapshot.created_at);
  await setSetting(env.DB, "content_backup_counts", JSON.stringify(snapshot.counts));
  await setSetting(env.DB, "content_backup_stored", stored ? "1" : "0");
  return { ...snapshot, stored };
}

// Runs at most once a day. Called from the API entry point, so any admin visit
// or storefront API call keeps the vault current without a background process.
export async function maybeAutoBackup(env) {
  if (!env.FILES) return { skipped: "no_storage" };
  if (Date.now() - lastAutoCheck < 60 * 60 * 1000) return { skipped: "checked" };
  lastAutoCheck = Date.now();
  const settings = await getSettings(env.DB, ["content_backup_at"]);
  const last = Date.parse(settings.content_backup_at || "");
  if (Number.isFinite(last) && Date.now() - last < AUTO_INTERVAL_MS) return { skipped: "fresh" };
  return createSnapshot(env, { reason: "auto" });
}

export async function backupStatus(env) {
  const settings = await getSettings(env.DB, ["content_backup_at", "content_backup_counts", "content_backup_stored", "content_restore_at"]);
  const counts = safeJson(settings.content_backup_counts, null);
  let latest = null;
  let previous = null;
  let beforeRestore = null;
  if (env.FILES) {
    latest = await readFileJson(env, AUTO_KEY).then((entry) => (entry ? entry.data : null)).catch(() => null);
    previous = await readFileJson(env, PREVIOUS_KEY).then((entry) => (entry ? entry.data : null)).catch(() => null);
    beforeRestore = await readFileJson(env, BEFORE_RESTORE_KEY).then((entry) => (entry ? entry.data : null)).catch(() => null);
  }
  return {
    available: Boolean(env.FILES),
    last_backup_at: settings.content_backup_at || "",
    last_backup_stored: settings.content_backup_stored === "1",
    restore_at: settings.content_restore_at || "",
    counts: counts && typeof counts === "object" ? counts : null,
    latest: latest ? { created_at: latest.created_at, reason: latest.reason || "auto", counts: latest.counts } : null,
    previous: previous ? { created_at: previous.created_at, reason: previous.reason || "auto", counts: previous.counts } : null,
    before_restore: beforeRestore ? { created_at: beforeRestore.created_at, reason: "before-restore", counts: beforeRestore.counts } : null,
    tables: Object.fromEntries(Object.entries(TABLES).map(([name, table]) => [name, table.label])),
  };
}

/* -------------------------------- restore --------------------------------- */

async function upsertRows(env, name, rows) {
  const table = TABLES[name];
  if (!table || !Array.isArray(rows) || !rows.length) return 0;
  // Vault bookkeeping describes the backup itself, not the store's content.
  const usable = name === "settings" ? rows.filter((row) => !BACKUP_META_KEYS.has(String(row && row.key))) : rows;
  if (!usable.length) return 0;
  const columns = table.columns;
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((column) => column !== table.key)
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  const verb = table.policy === "overwrite" ? `DO UPDATE SET ${updates}` : "DO NOTHING";
  const sql = `INSERT INTO ${name} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${table.key}) ${verb}`;
  let changed = 0;
  for (const group of chunks(usable.slice(0, MAX_RESTORE_ROWS), CHUNK)) {
    const statements = [];
    for (const raw of group) {
      const row = cleanRow(table, raw);
      if (!row[table.key]) continue;
      // Older backup files predate a column; null keeps the insert valid and the
      // schema default (sample on) is what the store already showed.
      statements.push(env.DB.prepare(sql).bind(...columns.map((column) => (row[column] === undefined ? null : row[column]))));
    }
    if (!statements.length) continue;
    if (typeof env.DB.batch === "function") {
      await env.DB.batch(statements);
    } else {
      for (const statement of statements) await statement.run();
    }
    changed += statements.length;
  }
  return changed;
}

async function restoreAssets(env, assets) {
  if (!env.FILES || !assets || typeof assets !== "object") return 0;
  let written = 0;
  let total = 0;
  for (const [key, entry] of Object.entries(assets).slice(0, MAX_ASSETS)) {
    if (!/^(covers|media)\//.test(key) || key.includes("..")) continue;
    if (!entry || typeof entry !== "object" || typeof entry.data !== "string") continue;
    if (entry.data.length > MAX_SINGLE_ASSET_BYTES * 1.4) continue;
    if (total + entry.data.length > MAX_EXPORT_ASSET_BYTES) break;
    try {
      const bytes = fromBase64(entry.data);
      await env.FILES.put(key, bytes, {
        httpMetadata: { contentType: String(entry.type || "application/octet-stream").slice(0, 100) },
      });
      total += entry.data.length;
      written += 1;
    } catch {
      // A bad image is skipped; never lose the rest of the restore because of it.
    }
  }
  return written;
}

export async function restoreSnapshot(env, snapshot, { includeLedger = true } = {}) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.tables) {
    throw new Error("That file is not a Neverbasic Diva backup.");
  }
  if (snapshot.app && snapshot.app !== "neverbasic-diva") {
    throw new Error("That backup belongs to a different site.");
  }
  if (Number(snapshot.version) > VERSION) {
    throw new Error("This backup was made by a newer version. Update the site first.");
  }
  const totalRows = Object.values(snapshot.tables).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  if (totalRows > MAX_RESTORE_ROWS) throw new Error("This backup is unexpectedly large.");

  // Keep the live state before touching anything, so a mistaken restore is
  // itself reversible.
  const current = await buildSnapshot(env);
  current.reason = "before-restore";
  if (env.FILES) await writeFileJson(env, BEFORE_RESTORE_KEY, current);

  const restored = {};
  for (const name of ["settings", "ebooks", "testimonials", "reviews", "bundles", "posts", "coupons"]) {
    restored[name] = await upsertRows(env, name, tableRows(snapshot, name));
  }
  // Audience and ledger rows are added only when missing. A restore must never
  // re-subscribe someone or overwrite a newer order status.
  restored.subscribers = await upsertRows(env, "subscribers", tableRows(snapshot, "subscribers"));
  if (includeLedger) {
    restored.customers = await upsertRows(env, "customers", tableRows(snapshot, "customers"));
    restored.orders = await upsertRows(env, "orders", tableRows(snapshot, "orders"));
    restored.resellers = await upsertRows(env, "resellers", tableRows(snapshot, "resellers"));
    restored.requests = await upsertRows(env, "requests", tableRows(snapshot, "requests"));
    restored.refunds = await upsertRows(env, "refunds", tableRows(snapshot, "refunds"));
    restored.tickets = await upsertRows(env, "tickets", tableRows(snapshot, "tickets"));
    restored.ticket_messages = await upsertRows(env, "ticket_messages", tableRows(snapshot, "ticket_messages"));
  }
  restored.assets = await restoreAssets(env, snapshot.assets);
  await setSetting(env.DB, "content_restore_at", nowIso());
  return restored;
}

export async function latestBackup(env) {
  const entry = await readFileJson(env, AUTO_KEY);
  return entry ? entry.data : null;
}

export async function beforeRestoreBackup(env) {
  const entry = await readFileJson(env, BEFORE_RESTORE_KEY);
  return entry ? entry.data : null;
}

export async function restoreLatest(env, options) {
  const entry = await readFileJson(env, AUTO_KEY);
  if (!entry || !entry.data) throw new Error("No automatic backup exists yet. Take a snapshot first.");
  const restored = await restoreSnapshot(env, entry.data, options);
  return { restored, backup_at: entry.data.created_at };
}
