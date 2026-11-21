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

## AI copy studio

The admin panel reads your PDF and writes the whole product page with real AI — then lets
you fix or regenerate any single piece of it.

**How the provider chain works**

1. **Groq** runs first, starting with `openai/gpt-oss-120b` (free tier), then
   `llama-3.3-70b-versatile`, then `llama-3.1-8b-instant`.
2. If Groq is out of quota, rate-limited, has a bad key or times out, the request falls
   through to **OpenRouter** and tries its free models in order
   (`deepseek-v3`, `deepseek-r1`, `llama-3.3-70b`, `qwen3-235b`, `mistral-small`, `gemma-3`).
3. A fourth, **custom** OpenAI-compatible endpoint can be added (label, base URL, models,
   key) for any other free provider.

Every attempt is logged and shown in the studio, and a failure is reported as a clear
message — never a crash or an empty product page. Provider keys can be pasted in
**Admin → AI studio** or set as environment variables (below); admin-saved keys win.

**What it generates**

- Title options, subtitle, hook, badge, category
- A long humanised description built on real behavioural levers (loss aversion,
  identity, specificity, future pacing) without fake claims
- Six outcome-led “what’s inside” bullets, private pain points, trigger notes, audience
- FAQ, SEO title/description, launch email, tags
- A free sample of the actual book opening (used by the storefront’s sample reader)
- Suggested impulse price and a believable MRP anchor

Each block has its own **Regenerate** button; **Apply to ebook** writes everything into the
catalogue, including the PDF you uploaded, so the same file buyers download is the one the
AI read. **AI store builder** can rewrite the whole home page (sections, order, copy, palette)
from a one-line brief, with a review step before it is installed.

---

## Growth tools

All of these are managed in **Admin → Growth** and can be switched off individually in
**Features** without touching code:

| Tool | What it does |
| --- | --- |
| Coupons | Percent or flat codes, minimum order, max uses, expiry. Validated server-side at checkout. |
| Bundles | Multi-ebook offers with their own price/MRP and a bundle checkout page. |
| Journal | Public posts at `/journal` with Markdown-lite body, drafts and publishing. |
| Newsletter | Section + footer capture, subscriber list and CSV export. |
| Verified reviews | Only paid buyers can review; every review is approved in admin before it shows. |
| Exit offer | One-time popup on exit, with a coupon code you choose. |
| Social proof | Quiet toasts from real recent paid orders (first name + ebook). |
| AI assistant | Chat widget that answers from your catalogue with links to the right page. |
| Search & wishlist | Instant `/search`, saved hearts and a `/wishlist` page on the device. |
| Recently viewed | A quiet strip of books the visitor already opened. |
| Samples | “Read a free sample” panel on every product page. |
| Receipts | Paid buyers download a PDF receipt. |
| Sticky buy | Price and buy button that follow the scroll. |
| Order upsell | Recommends the next ebook after a paid order. |
| Countdown, ticker, split, proof, WhatsApp | Extra store-builder sections, all editable. |

The storefront ships **20 toggleable features**; the admin panel adds AI studio, growth,
themes, security sessions, audit log and one-file backups.

---

## Store builder

- **10 complete themes** (Rose editorial, Noir femme, Neon diva, Cream minimal, Emerald
  luxe, Midnight gold, Blush pastel, Brutal pop, Terracotta sun, Slate studio) — one click
  sets palette, shape language, type pairing and spacing.
- **20 section types**, including hero, library, bundles, journal, newsletter, countdown,
  ticker, split image/text, verified proof, WhatsApp band, FAQ, promise, resell and CTA.
- Reorder, duplicate, hide, reset any section; edit every field; **AI rewrite** inside any
  section with your own instruction.
- Layout backup: download the whole design as JSON and restore it later.
- `Ctrl/Cmd + S` publishes.

---

## Payments

**Admin → Payments** is the only place keys live. No code, no redeploy.

| Gateway | What you paste |
| --- | --- |
| PayU | Merchant key + salt, test/live mode |
| Razorpay | Key id + key secret (test or live) |
| Stripe | Secret key (+ optional publishable key) |
| Fallback | Payment link and/or UPI ID with your own instructions |

Choose **Auto** (first connected gateway) or pin a specific one. Verification:

- PayU reverse hash **and** amount check
- Razorpay HMAC signature **and** order-id match, so a signature cannot be replayed
  against a different reference
- Stripe: the checkout session is retrieved server-side and `amount_total` is checked;
  the optional webhook signature is verified with a 5-minute replay window

If a gateway API is down or a key is wrong, checkout **automatically falls back** to your
payment link / UPI and keeps the order, so a sale is never lost to an outage.

---

## Security

- PBKDF2 (120k iterations) password hashing, HTTP-only SameSite session cookies, login
  rate limiting and expired-session cleanup.
- CSRF guard: state-changing requests must come from your own origin. Gateway callbacks are
  exempt and verified by signature instead.
- Content Security Policy, `nosniff`, referrer and permissions headers on every response.
- Uploads restricted to PDF or real image extensions; private files only served through
  paid, random download tokens.
- Rate limits on coupons, reviews, newsletter, assistant and AI generation.
- Changing the admin password signs out every other device; active sessions, audit log and
  a full JSON backup live in **Admin → Security**.
- Payment secrets are never included in public API payloads.

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite (SPA, hand-written CSS) |
| API | Cloudflare Worker (ESM, bundled with esbuild) |
| Database | Cloudflare D1 (SQLite) — schema auto-created and seeded on first request |
| Files | Cloudflare R2 — private PDFs, public cover images |
| Payments | PayU, Razorpay or Stripe — configured from the admin panel, with link/UPI fallback |
| AI | Groq (`openai/gpt-oss-120b`) → OpenRouter free models → optional custom provider |
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

### Netlify (storefront + API)

`netlify.toml` builds the SPA into `dist/client` and serves it from Netlify, with the API running on Netlify at `/api/*`:

- `netlify/server/index.mjs` — Netlify Server entry that passes every request to the store API
- `netlify/server/bindings.mjs` — D1/R2 shims backed by Netlify Database (Postgres) and Netlify Blobs
- `netlify/database/migrations/` — schema, applied automatically at deploy time

Import the repository in Netlify (build command `npm run build`, publish directory `dist/client`), or deploy the build output manually. The build pins Node 22 because Vite 8 needs Node 20.19 or newer.

The new growth/AI tables ship as
the migration `20261121160000_add_growth_and_ai_tables.sql` and are applied automatically
on deploy. Existing ebooks, orders and settings are left untouched.

### Netlify environment variables

Everything can be configured in the admin panel, but if you prefer environment variables
(or want a free key shared across deploys), add these under **Netlify → Site configuration →
Environment variables**. Admin-pasted keys take priority; environment keys are the fallback.

| Variable | Required? | Where to get it | Used for |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | For AI features | [console.groq.com](https://console.groq.com) → API keys | Primary free model (`openai/gpt-oss-120b`) |
| `OPENROUTER_API_KEY` | Recommended fallback | [openrouter.ai/keys](https://openrouter.ai/keys) | Free models when Groq quota runs out |
| `ADMIN_EMAIL` | First run | Your own email | Owner account created on first boot |
| `ADMIN_PASSWORD` | First run | Your own password (8+ characters) | Password for that owner account |

`ADMIN_EMAIL` + `ADMIN_PASSWORD` are only used while no admin with that email exists —
the password is hashed on the way in and never stored in the repo. To use them locally,
put both in a `.dev.vars` file (git-ignored) next to `wrangler.toml` and restart
`wrangler dev`. Changing the password later from **Admin → Security** is not overwritten
by these variables.

No other environment variables are needed. Payment keys, brand content and every store
setting are stored in your database and edited from `/admin`, so they are never exposed to
the browser or committed to the repository.

Optional extra providers can be added in **Admin → AI studio → Optional fourth provider**
(any OpenAI-compatible base URL with `/v1`).

### Cloudflare / Freebuff Sites

The project also ships `sites.manifest.json` for Freebuff Sites (Workers + assets + D1 + R2).

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
  index.js       API router: storefront, orders, gateways, delivery, support, resell, admin
  db.js          schema, defaults, seed ebooks/reviews, settings helpers, migrations
  ai.js          provider chain (Groq → OpenRouter → custom), PDF text extraction, prompts
  payments.js    PayU / Razorpay / Stripe creation, verification and fallback
  features.js    coupons, bundles, journal, newsletter, reviews, AI and security routes
  util.js        cookies, PBKDF2, PayU hashing, demo PDF generator
src/
  App.jsx        shell, routes, theme from settings
  lib/api.jsx    fetch client, router, site context
  lib/pay.jsx    PayU form submit / order redirect
  ui.jsx         buttons, fields, modal, reveal, FAQ, toasts
  pages/         Home, Store (library/detail/checkout/order/track), Support (help/request/refund/policies/resell/portal)
  admin/Admin.jsx admin studio shell, orders, ebooks, payments, content
  admin/AiStudio.jsx AI providers, ebook analyser, store generator
  admin/Growth.jsx coupons, bundles, journal, subscribers, reviews, feature switches
  admin/Security.jsx sessions, audit log, backups
  admin/Studio.jsx pages, themes, copy, look, AI section rewrite
  pages/Extras.jsx search, wishlist, journal, bundles, assistant and growth widgets
  styles.css     full design system (storefront + studio)
  features.css   growth/AI storefront styles
  admin.css      growth/AI admin styles
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
