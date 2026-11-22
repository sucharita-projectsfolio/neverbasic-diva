// Build-time content safety guard.
//
// Runs before every production build (npm run build), so a code update that
// would quietly damage the live store fails instead of deploying:
//   • a protected storefront image is deleted or changed,
//   • a migration drops, renames or truncates data,
//   • the first-run seed starts overwriting existing settings/ebooks,
//   • the database or bucket binding is pointed somewhere else.
//
// Intentional changes are approved explicitly with `npm run content:approve`
// and committed, which leaves a one-line diff in content-lock.json.
//
// This works with no database credentials: it only reads the repository.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "content-lock.json");
const approve = process.argv.includes("--approve");
const problems = [];

const rel = (file) => path.relative(root, file).split(path.sep).join("/");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function protectedFiles() {
  const files = {};
  for (const file of (await walk(path.join(root, "public"))).sort()) {
    const info = await stat(file);
    if (info.size === 0) {
      problems.push(`${rel(file)} is empty — a zero-byte image would show a broken cover.`);
      continue;
    }
    files[rel(file)] = { sha256: sha256(await readFile(file)), bytes: info.size };
  }
  return files;
}

async function bindings() {
  const file = path.join(root, "wrangler.toml");
  if (!existsSync(file)) return {};
  const source = await readFile(file, "utf8");
  const read = (pattern) => {
    const match = pattern.exec(source);
    return match ? match[1] : "";
  };
  return {
    database_name: read(/database_name\s*=\s*"([^"]+)"/),
    database_id: read(/database_id\s*=\s*"([^"]+)"/),
    bucket_name: read(/bucket_name\s*=\s*"([^"]+)"/),
  };
}

async function checkMigrations() {
  const dir = path.join(root, "netlify/database/migrations");
  if (!existsSync(dir)) return;
  for (const file of (await walk(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    const source = await readFile(file, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("data-safe-approved")) return;
      const sql = line.replace(/--.*$/, "").trim();
      if (!sql) return;
      if (/\b(DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE\s+\S+\s+(DROP|RENAME))\b/i.test(sql)) {
        problems.push(
          `${rel(file)}:${index + 1} looks destructive: "${sql.slice(0, 90)}". ` +
            "Use an additive migration, or add -- data-safe-approved on the line if this is genuinely intended."
        );
      }
      if (/^\s*UPDATE\s+/i.test(sql)) {
        problems.push(
          `${rel(file)}:${index + 1} edits existing rows: "${sql.slice(0, 90)}". ` +
            "Migrations should only add schema; edit content from the admin panel. Add -- data-safe-approved only if the owner asked for this data change."
        );
      }
    });
  }
}

async function checkSeed() {
  const file = path.join(root, "worker/db.js");
  if (!existsSync(file)) return;
  const source = await readFile(file, "utf8");
  const start = source.indexOf("async function init(env)");
  const end = source.indexOf("// Drops retired model ids", start);
  const body = start >= 0 ? source.slice(start, end > start ? end : source.length) : "";
  if (!body) {
    problems.push("worker/db.js: could not find the first-run init() block to check.");
    return;
  }
  if (/INSERT\s+OR\s+REPLACE|REPLACE\s+INTO/i.test(body)) {
    problems.push("worker/db.js: first-run seed uses INSERT OR REPLACE, which would overwrite saved content.");
  }
  if (/ON\s+CONFLICT[\s\S]{0,200}?DO\s+UPDATE/i.test(body)) {
    problems.push("worker/db.js: first-run seed calls DO UPDATE, which could overwrite an admin's saved content.");
  }
  if (/\b(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i.test(body)) {
    problems.push("worker/db.js: first-run init() contains a destructive statement.");
  }
  if (/\bUPDATE\s+(settings|ebooks|testimonials|reviews|bundles|posts|coupons|orders|customers|subscribers)\b/i.test(body)) {
    problems.push("worker/db.js: first-run init() updates existing content. New keys may be inserted, never overwritten.");
  }

  const altersStart = source.indexOf("export const MIGRATION_ALTERS");
  const altersEnd = source.indexOf("];", altersStart);
  const alters = altersStart >= 0 ? source.slice(altersStart, altersEnd > altersStart ? altersEnd : source.length) : "";
  if (/\b(UPDATE\s+(ebooks|testimonials|reviews|bundles|posts|coupons|orders|customers|subscribers)|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i.test(alters)) {
    problems.push("worker/db.js: MIGRATION_ALTERS edits or deletes existing store content. Keep migrations additive.");
  }

  // Every cover referenced by the seed must exist in the repo, so deleting one
  // can never leave the default catalogue with broken product images.
  const covers = new Set(source.match(/\/covers\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif|svg)/gi) || []);
  for (const cover of covers) {
    const full = path.join(root, "public", cover.replace(/^\//, ""));
    if (!existsSync(full)) problems.push(`worker/db.js references ${cover}, but public${cover} is missing.`);
  }
}

async function checkLock(lock) {
  const current = await protectedFiles();
  const saved = (lock && lock.files) || {};
  for (const [file, meta] of Object.entries(saved)) {
    if (!current[file]) {
      problems.push(`${file} is protected but missing. Restore it, or run npm run content:approve if its removal is intentional.`);
    } else if (current[file].sha256 !== meta.sha256) {
      problems.push(`${file} changed. Restore the original, or run npm run content:approve if this is intentional.`);
    }
  }
  for (const file of Object.keys(current)) {
    if (!saved[file]) {
      problems.push(`${file} is not in content-lock.json yet. Run npm run content:approve to protect it.`);
    }
  }
  const currentBindings = await bindings();
  const savedBindings = (lock && lock.bindings) || {};
  for (const [key, value] of Object.entries(savedBindings)) {
    if (currentBindings[key] && currentBindings[key] !== value) {
      problems.push(
        `wrangler.toml ${key} changed from "${value}" to "${currentBindings[key]}". ` +
          "Point it back at the same live database, or run npm run content:approve if this is intentional."
      );
    }
  }
  return { current, currentBindings };
}

async function main() {
  const lock = existsSync(lockPath) ? JSON.parse(await readFile(lockPath, "utf8")) : null;
  if (!lock && !approve) {
    problems.push("content-lock.json is missing. Run npm run content:approve once and commit it.");
  }

  if (approve) {
    const current = await protectedFiles();
    const currentBindings = await bindings();
    const next = {
      version: 1,
      note: "Protected storefront files and live storage bindings. npm run build fails if these change without npm run content:approve.",
      approved_at: new Date().toISOString(),
      files: current,
      bindings: currentBindings,
    };
    await writeFile(lockPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`✓ content lock updated (${Object.keys(current).length} files, ${Object.keys(currentBindings).length} bindings)`);
    return;
  }

  await checkMigrations();
  await checkSeed();
  const { current } = await checkLock(lock);

  if (problems.length) {
    console.error("\n✗ Content safety check failed:\n");
    for (const problem of problems) console.error(`  • ${problem}`);
    console.error(
      "\nThe live store's products, copy and images live in the database and R2/Blobs, not in this repo.\n" +
        "Do not delete data to make this check pass. Restore the file, or approve the change on purpose:\n" +
        "  npm run content:approve\n"
    );
    process.exit(1);
  }

  console.log(`✓ content safety check passed (${Object.keys(current).length} protected files)`);
}

await main();
