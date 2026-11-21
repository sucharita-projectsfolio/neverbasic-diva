# Neverbasic Diva

A complete, self-managed ebook store: premium micro-ebooks priced like a cup of chai, instant PDF delivery after payment, resell licences, and an admin studio that controls everything — content, pricing, payments, orders, support, refunds and resellers — without touching code.

Live storefront: **`/`** · Admin studio: **`/admin`**

---

## What it does

**Storefront**
- Editorial home page with masonry library, reader reviews, FAQ, resell and refund sections
- Ebook detail pages with highlights, pricing and what-happens-after-payment flow
- Checkout with PayU hosted payment, or a payment link / UPI fallback
- Order page: status, PDF download, payment reference submission, full event timeline
- `/track` — reopen any order with reference + email
- `/resell` — buy a 1-year resell licence, then use `/resell/portal` to download licensed PDFs
- `/support` ticketing with threaded replies, `/request` for custom ebook requests, `/refund` for the material-first-then-refund promise, `/policies`

**Admin studio (`/admin`)**
- First-run setup creates the single admin account (PBKDF2-hashed, httponly session cookie)
- Overview: revenue, paid/pending orders, downloads, weekly visits, 14-day revenue chart, order funnel, best sellers
- Orders: search + status filters, verify UTR, mark paid & unlock, refund, cancel, refresh access link, internal notes, CSV export
- Ebooks: CRUD, cover upload, private PDF upload, price/MRP, badge, featured, draft/publish
- Payments: PayU key/salt/mode, plus payment link, UPI ID and post-order instructions
- Resellers: licence price, open/close programme, activate/extend/revoke, clicks + sales
- Support, ebook requests, refunds (material sent / approve / reject), reviews
- Site content: brand, hero copy, Instagram, colours, stats/FAQs JSON, policies
- Account: change password, export orders

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite (SPA, hand-written CSS) |
| API | Cloudflare Worker (ESM, bundled with esbuild) |
| Database | Cloudflare D1 (SQLite) — schema auto-created and seeded on first request |
| Files | Cloudflare R2 — private PDFs, public cover images |
| Payments | PayU hosted checkout (SHA-512 hash + reverse-hash + amount verification) |
| Hosting | Cloudflare Workers + static assets (Freebuff Sites ready) |

No framework runtime, no ORM, no external services required.

---

## Run locally

```bash
npm install
npm start          # builds client + worker, then wrangler dev on http://localhost:3000
```

`npm start` requires no Cloudflare account: D1 and R2 run in local Miniflare storage under `.wrangler/`.

1. Open `http://localhost:3000`
2. Go to `/admin` and create your admin email + password
3. Upload a real PDF from **Ebooks & PDFs** (seeded ebooks ship with placeholder PDFs so the delivery flow is testable)
4. Add PayU keys, a payment link / UPI, or leave it on manual verification

Other commands:

```bash
npm run build      # vite client build + esbuild worker bundle into dist/
```

---

## Payments

### PayU

Admin → Payments:

- **Merchant key** and **salt** (stored server-side in D1; the salt is never sent to the browser)
- **Mode**: Test (`test.payu.in`) or Live (`secure.payu.in`)
- **Success/failure URL**: `https://your-domain/api/payu/return`
- Optional webhook: `https://your-domain/api/payu/webhook`

Flow:

1. `POST /api/orders` creates a pending order, computes the request hash server-side and returns the PayU form fields
2. Buyer pays on PayU's hosted checkout
3. PayU posts back to `/api/payu/return`; the worker verifies the reverse hash **and** the paid amount before unlocking
4. A forged or tampered response is logged on the order timeline and never unlocks a file

When PayU is off, the store falls back to a payment link / UPI ID. The buyer submits their UTR on the order page and the admin confirms it in Orders → Manage → **Mark paid & unlock**.

### Refunds

Buyer opens a request from their order page or `/refund` with a preference (matched material or refund). Admin reviews it and marks **material sent**, **approve** (order becomes refunded) or **reject**.

---

## Resell rights

- One-time licence, default ₹399 for 365 days, fully configurable in admin
- Payment activates the licence automatically: reseller code (`DIVA-XXXX`), expiry, tracked link `?res=CODE`
- `/resell/portal` gives licence holders the sellable PDFs, click and sales counters
- Admin can extend by a year or revoke at any time

---

## Deploy

The project ships `sites.manifest.json` for Freebuff Sites (Workers + assets + D1 + R2).

Bindings required in the Worker environment:

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 database | settings, ebooks, orders, tickets, refunds, resellers |
| `FILES` | R2 bucket | private PDFs + cover uploads |
| `ASSETS` | static assets | built SPA in `dist/client` |

`sites.manifest.json`:

```json
{
  "entrypoint": "worker.js",
  "compatibilityDate": "2025-09-01",
  "compatibilityFlags": ["nodejs_compat"],
  "modules": [{ "name": "worker.js", "type": "esm", "path": "./dist/worker.js" }],
  "assetsDirectory": "./dist/client",
  "spa": true
}
```

The schema is created automatically on the first API request, so no migration step is needed. Data persists in D1 and R2 after deployment — admin changes made in production are permanent.

---

## Project structure

```
worker/
  index.js       API router: storefront, orders, PayU, delivery, support, resell, admin
  db.js          schema, defaults, seed ebooks/reviews, settings helpers
  util.js        cookies, PBKDF2, PayU hashing, demo PDF generator
src/
  App.jsx        shell, routes, theme from settings
  lib/api.jsx    fetch client, router, site context
  lib/pay.jsx    PayU form submit / order redirect
  ui.jsx         buttons, fields, modal, reveal, FAQ, toasts
  pages/         Home, Store (library/detail/checkout/order/track), Support (help/request/refund/policies/resell/portal)
  admin/Admin.jsx admin studio
  styles.css     full design system (storefront + studio)
public/covers/   seed cover art
scripts/build.mjs build pipeline
wrangler.toml    local bindings (D1, R2, assets)
sites.manifest.json deployment manifest
```

---

## Notes

- Seed ebooks, reviews and cover art are sample content intended to be replaced.
- PDFs served before an admin upload are clearly labelled demo preview files.
- Order access is a stable token tied to the paid order; every download is counted and logged.
- Public API payloads never include file keys, PayU salt or admin data.
- No transactional email is connected; support replies live on the ticket page and the admin panel offers a mailto link. Add an email provider if you want automatic receipts.
