# AGENTS.md — read this before changing anything

This repository is the Neverbasic Diva ebook store. The live shop is not the
repository: products, prices, hero copy, reviews, orders and uploaded images live
in the database and in file storage (Cloudflare D1 + R2, or Netlify Database +
Blobs). A code deploy must never be used to edit or reset that content.

The owner may open this repo in another AI app and ask for changes. Follow the
rules below exactly.

## Data safety rules (non-negotiable)

1. **Never change live content through code.** To change a product, price,
   hero line, FAQ, review, coupon or page section, use the admin panel
   (`/admin`) or ask the owner to. Do not edit seed/default values in
   `worker/db.js` to change what the live store shows.
2. **The first-run seed may only insert when the table is empty.** Keep
   `INSERT ... ON CONFLICT DO NOTHING` semantics in `init()`. Never add
   `INSERT OR REPLACE`, `REPLACE INTO`, `DO UPDATE`, `DELETE`, `TRUNCATE` or
   `DROP` to the seed/init path.
3. **Migrations are additive only.** Add columns/tables/indexes. Do not drop,
   rename or truncate existing tables/columns, and do not write `DELETE FROM`
   in a migration. Existing rows are the owner's business data.
4. **Never delete or rewrite protected images.** `public/covers/*` and the
   files listed in `content-lock.json` are product/hero art. If the build guard
   fails because of an image, stop and ask the owner. Do not run
   `npm run content:approve` unless the owner explicitly asked to change that
   image.
5. **Never change the storage bindings.** `wrangler.toml` `database_name`,
   `database_id` and `bucket_name` must point at the same live database and
   bucket. Do not create a fresh database, bucket or Netlify site to "fix" a
   deploy.
6. **Never reset admin access** or remove accounts/sessions to solve a login
   problem. Never delete orders, customers or tickets.
7. **Never commit secrets.** API keys, PayU/Razorpay/PayPal secrets, Resend
   keys, Meta CAPI tokens and `ADMIN_PASSWORD` stay in hosting settings or
   `.dev.vars` (gitignored). Keys pasted in admin are stored in the database and
   are not part of a code change.
8. **Do not remove the backup system.** The routes in `worker/backup.js`, the
   admin tab `Growth → Backup & safety`, and `scripts/guard-content.mjs` are
   part of the safety contract.

## Before and after any schema or data-related change

- Take a backup first: Admin → Growth → Backup & safety → **Take a snapshot
  now** (or download the full backup).
- Run `npm run build`. It runs the content guard before bundling. A failing
  guard means the change could damage live content: fix the cause, do not
  bypass it.
- After deploy, check `/api/site` still returns the same product count/titles
  and open one product page. Report what you checked.
- If something is missing, restore from Admin → Growth → Backup & safety
  (latest snapshot or the downloaded file). Restore is merge-only and never
  deletes newer rows.

## Backup system (already implemented)

- Daily automatic snapshot: `worker/backup.js` writes `backups/latest.json` and
  keeps the previous one as `backups/previous.json` in private file storage.
- Full export: `GET /api/admin/backup/export` — all content tables, orders,
  customers, support records and uploaded cover/media images as one JSON file.
- Restore: `POST /api/admin/backup/restore` (uploaded file) or
  `POST /api/admin/backup/restore-latest`; requires the literal confirmation
  `RESTORE`; saves the current state to `backups/before-restore.json` first.
- PDF product files are intentionally not embedded in the JSON (size). They live
  in R2/Blobs under `pdf/` and code deploys do not touch them. Keep the original
  PDFs in the owner's own storage as well.

## Project map

- `worker/index.js` — API entry, storefront payload, orders, admin routes.
- `worker/db.js` — schema, defaults and first-run seed (read rule 2).
- `worker/backup.js` — snapshot/export/restore vault.
- `worker/features.js` — growth/admin extras (coupons, bundles, reviews, …).
- `src/` — React storefront and admin (`src/admin/Growth.jsx` has the backup UI).
- `public/covers/` — protected seed cover art (build guard).
- `netlify/database/migrations/` — additive SQL migrations only.
- `scripts/guard-content.mjs` — fails the build on destructive content changes.
- `content-lock.json` — hashes of protected files and the live binding names.

## Local checks

```bash
npm ci
npm run guard      # content safety check only
npm run build      # guard + client + worker bundle
```

Do not use `npm run content:approve` as a shortcut to make the build pass. It is
an explicit owner decision that rewrites `content-lock.json`.

## Design and copy

Keep the existing brand voice: sharp, warm, specific, no fake claims. Do not
rewrite the owner's copy unless asked. New UI should use the existing design
system (`src/styles.css`, `src/features.css`, `src/admin.css`) and stay fast on
mobile.
