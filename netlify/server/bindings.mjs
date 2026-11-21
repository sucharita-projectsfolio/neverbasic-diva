// Netlify-backed replacements for the Cloudflare bindings the API worker expects:
//   DB     -> Netlify Database (Postgres) behind a small D1-compatible interface
//   FILES  -> Netlify Blobs behind a small R2-compatible interface
//   ASSETS -> single-page-app fallback to the built index.html
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";

// Postgres returns COUNT/SUM results as strings (int8/numeric); D1 returned numbers.
const NUMERIC_TYPES = new Set([20, 1700]);

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeRows(result) {
  const numeric = (result.fields || []).filter((f) => NUMERIC_TYPES.has(f.dataTypeID)).map((f) => f.name);
  if (!numeric.length) return result.rows;
  return result.rows.map((row) => {
    for (const name of numeric) if (row[name] !== null && row[name] !== undefined) row[name] = Number(row[name]);
    return row;
  });
}

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params.map((p) => (p === undefined ? null : p)));
  }
  async execute(client) {
    const result = await (client || this.db.pool).query(toPg(this.sql), this.params);
    return { rows: normalizeRows(result), rowCount: result.rowCount };
  }
  async first() {
    const { rows } = await this.execute();
    return rows[0] ?? null;
  }
  async all() {
    const { rows } = await this.execute();
    return { results: rows, success: true, meta: {} };
  }
  async run() {
    const { rowCount } = await this.execute();
    return { success: true, meta: { changes: rowCount } };
  }
}

class Database {
  constructor() {
    this.schemaManaged = true;
    this._pool = null;
  }
  get pool() {
    if (!this._pool) this._pool = getDatabase().pool;
    return this._pool;
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  async batch(statements) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const out = [];
      for (const statement of statements) {
        const { rows, rowCount } = await statement.execute(client);
        out.push({ results: rows, success: true, meta: { changes: rowCount } });
      }
      await client.query("COMMIT");
      return out;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

class FileStore {
  constructor() {
    this._store = null;
  }
  get store() {
    if (!this._store) this._store = getStore({ name: "files", consistency: "strong" });
    return this._store;
  }
  async get(key) {
    const entry = await this.store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!entry || !entry.data) return null;
    return {
      body: entry.data,
      httpMetadata: { contentType: entry.metadata?.contentType || "" },
    };
  }
  async put(key, data, options = {}) {
    await this.store.set(key, data, {
      metadata: { contentType: options.httpMetadata?.contentType || "" },
    });
  }
}

const assets = {
  // Static files are served by the CDN before requests reach the server, so anything that
  // gets here is a client-side route (e.g. /admin, /track). Serve the SPA shell for it.
  async fetch(request) {
    const shell = await fetch(new URL("/index.html", request.url), {
      headers: { accept: "text/html" },
    });
    return new Response(shell.body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
    });
  },
};

// Netlify site environment variables are passed through so the AI provider chain
// can read keys from the Netlify dashboard instead of the admin panel. Admin-saved
// keys always win; these are the fallback. Values are never sent to the browser.
function passthroughEnv() {
  const out = {};
  const keys = [
    "GROQ_API_KEY",
    "GROQ_KEY",
    "OPENROUTER_API_KEY",
    "OPENROUTER_KEY",
    // First-run owner account. Only used when no admin with this email exists.
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
  ];
  if (typeof process !== "undefined" && process.env) {
    for (const key of keys) {
      if (process.env[key]) out[key] = process.env[key];
    }
  }
  return out;
}

export const env = {
  DB: new Database(),
  FILES: new FileStore(),
  ASSETS: assets,
  ...passthroughEnv(),
};
