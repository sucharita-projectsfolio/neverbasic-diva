import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  currencyConfigFor,
  formatPrice,
  Link,
  money,
  navigate,
  prettyDateTime,
  recallOrder,
  rememberOrder,
  usePath,
  useSite,
} from "../lib/api.jsx";
import { methodsForCurrency, startPayment } from "../lib/pay.jsx";
import Ebook3D from "../components/Ebook3D.jsx";
import {
  Button,
  Chip,
  CopyButton,
  Cover,
  Empty,
  Faq,
  Field,
  Input,
  Modal,
  Reveal,
  Spinner,
  StatusPill,
  Textarea,
  useToast,
} from "../ui.jsx";
import EbookCard, { WishButton } from "./EbookCard.jsx";
import { readKit } from "../lib/sitekit.js";
import { Rich } from "./blocks.jsx";
import { ProductReviews, RatingInline, RecentlyViewed, ReviewForm, SampleModal, ShareRow, useTrackRecent } from "./Extras.jsx";

export function Shop() {
  const { site } = useSite();
  const { content: copy } = readKit(site);
  const [category, setCategory] = useState("All");
  const ebooks = site.ebooks || [];
  const categories = ["All", ...Array.from(new Set(ebooks.map((book) => book.category).filter(Boolean)))];
  const list = category === "All" ? ebooks : ebooks.filter((book) => book.category === category);

  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">{copy.shop_eyebrow}</span>
          <h1>
            <Rich text={copy.shop_title} />
          </h1>
          <p>{copy.shop_sub}</p>
        </header>
        <div className="filter-row">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={`filter-pill ${category === item ? "active" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
          <span className="filter-count">{list.length} ebooks</span>
        </div>
        {list.length ? (
          <div className="masonry">
            {list.map((ebook, index) => (
              <EbookCard key={ebook.id} ebook={ebook} index={index} />
            ))}
          </div>
        ) : (
          <Empty title="Nothing here yet" text="New ebooks are added often. Check the full library." />
        )}
        <div className="shop-note">
          <strong>Every purchase includes</strong>
          <span>Instant PDF download</span>
          <span>Permanent order page</span>
          <span>100% refund promise</span>
          <span>WhatsApp-ready support</span>
        </div>
        <RecentlyViewed compact />
      </div>
    </div>
  );
}

export function EbookPage({ slug }) {
  const { site } = useSite();
  const ebook = (site.ebooks || []).find((book) => book.slug === slug);
  const others = (site.ebooks || []).filter((book) => book.slug !== slug).slice(0, 3);
  const [sampleOpen, setSampleOpen] = useState(false);
  const bundleOffer =
    ebook && site.features?.bundleUpsell !== false && site.features?.bundles !== false
      ? (site.bundles || []).find((bundle) => (bundle.items || []).some((item) => item.id === ebook.id))
      : null;
  useTrackRecent(ebook);

  if (!ebook) {
    return (
      <div className="page wrap">
        <Empty
          title="That ebook has moved"
          text="It may have been renamed or unpublished."
          action={<Link to="/ebooks" className="btn btn-primary">Back to the library</Link>}
        />
      </div>
    );
  }

  const discount = ebook.mrp > ebook.price ? Math.round((1 - ebook.price / ebook.mrp) * 100) : 0;

  return (
    <div className="page detail-page">
      <div className="wrap">
        <div className="crumbs">
          <Link to="/">Home</Link> <span>/</span> <Link to="/ebooks">Library</Link> <span>/</span>
          <span className="muted">{ebook.title}</span>
        </div>
        <div className="detail-grid">
          <Reveal className="detail-art">
            <div className="detail-3d">
              <Ebook3D ebook={ebook} badge={ebook.badge} href={null} />
            </div>
            <div className="detail-ingredients">
              <span>PDF · {ebook.pages || "short"} pages</span>
              <span>{ebook.category}</span>
              <span>Instant access</span>
            </div>
          </Reveal>
          <div className="detail-copy">
            <Reveal>
              <span className="eyebrow">{ebook.category} · neverbasic diva</span>
              <h1>{ebook.title}</h1>
              <p className="detail-sub">{ebook.subtitle}</p>
              <RatingInline ebook={ebook} />
              <ShareRow ebook={ebook} />
            </Reveal>
            <Reveal delay={80} className="detail-price-row">
              <span className="detail-price">{money(ebook.price)}</span>
              {ebook.mrp > ebook.price ? <s>{money(ebook.mrp)}</s> : null}
              {discount ? <Chip tone="accent">{discount}% off</Chip> : null}
              <span className="price-compare">≈ one cup of chai</span>
            </Reveal>
            <Reveal delay={120}>
              <div className="detail-desc">
                {String(ebook.description || "")
                  .split(/\n{2,}/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            </Reveal>
            {ebook.highlights?.length ? (
              <Reveal delay={160} className="detail-inside">
                <h3>What's inside</h3>
                <ul>
                  {ebook.highlights.map((item, index) => (
                    <li key={index}>
                      <span className="tick" aria-hidden="true">
                        ✦
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
            {ebook.sample ? (
              <Reveal delay={180} className="detail-sample">
                <h3>A page from inside</h3>
                <blockquote>{ebook.sample.split(/\s+/).slice(0, 95).join(" ")}…</blockquote>
                {site.features?.samples ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSampleOpen(true)}>
                    Read the full sample
                  </button>
                ) : null}
              </Reveal>
            ) : null}
            {ebook.ai_meta?.audience ? (
              <Reveal delay={190} className="detail-audience">
                <h3>Who it's for</h3>
                <p>{ebook.ai_meta.audience}</p>
              </Reveal>
            ) : null}
            <Reveal delay={200} className="buy-box">
              <div className="buy-box-top">
                <div>
                  <span className="buy-label">Instant download</span>
                  <strong>{money(ebook.price)}</strong>
                </div>
                <div className="buy-actions">
                  <Link to={`/checkout/${ebook.id}`} className="btn btn-primary btn-lg">
                    Get it now →
                  </Link>
                  {site.features?.samples ? (
                    <button type="button" className="btn btn-ghost" onClick={() => setSampleOpen(true)}>
                      Read a free sample
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="buy-fine">
                Pay by UPI, card or netbanking. Your PDF unlocks immediately and stays on your order page
                forever.
              </p>
              {site.features?.trustBadges !== false ? (
                <div className="buy-trust">
                  <span>✿ 100% refund promise</span>
                  <span>✿ No subscription</span>
                  <span>✿ Personal licence</span>
                  <span>✿ Instant PDF</span>
                </div>
              ) : null}
            </Reveal>
            {bundleOffer ? (
              <Reveal delay={220}>
                <Link to={`/bundle/${bundleOffer.slug}`} className="bundle-upsell">
                  <div>
                    <span className="eyebrow">better together</span>
                    <strong>
                      This + {Math.max(0, (bundleOffer.count || 1) - 1)} more for {money(bundleOffer.price)}
                    </strong>
                    <small>
                      {bundleOffer.mrp > bundleOffer.price ? `Save ${money(bundleOffer.mrp - bundleOffer.price)} · ` : ""}
                      {bundleOffer.count || 1} PDFs, one payment
                    </small>
                  </div>
                  <span className="btn btn-secondary btn-sm">See the bundle →</span>
                </Link>
              </Reveal>
            ) : null}
            <Reveal delay={240} className="detail-after">
              <h3>What happens after you pay</h3>
              <ol>
                <li>Payment verifies on this site (usually a few seconds).</li>
                <li>Your order page unlocks the PDF — one click, no email wait.</li>
                <li>You get an order reference you can reopen any time from “My order”.</li>
              </ol>
              {site.settings.resell_enabled === "1" ? (
                <p className="detail-resell">
                  Want to sell it too? <Link to="/resell">Resell rights cost ₹{site.settings.resell_price || 399} for a year →</Link>
                </p>
              ) : null}
            </Reveal>
          </div>
        </div>

        {site.features?.stickyBuy ? (
          <div className="sticky-buy">
            <div>
              <strong>{ebook.title}</strong>
              <small>{money(ebook.price)} · instant PDF</small>
            </div>
            <Link to={`/checkout/${ebook.id}`} className="btn btn-primary">
              Buy now →
            </Link>
          </div>
        ) : null}

        {ebook.ai_meta?.faq?.length ? (
          <section className="section detail-faq">
            <div className="section-head">
              <div>
                <span className="eyebrow">before you buy</span>
                <h2>Straight answers</h2>
              </div>
            </div>
            <Faq items={ebook.ai_meta.faq} />
          </section>
        ) : null}

        <ProductReviews ebook={ebook} />

        {others.length ? (
          <section className="section related">
            <div className="section-head">
              <div>
                <span className="eyebrow">keep going</span>
                <h2>
                  Readers also <em>stacked</em> these.
                </h2>
              </div>
            </div>
            <div className="masonry">
              {others.map((book, index) => (
                <EbookCard key={book.id} ebook={book} index={index} />
              ))}
            </div>
          </section>
        ) : null}

        <RecentlyViewed excludeId={ebook.id} compact />
      </div>
      <SampleModal ebook={ebook} open={sampleOpen} onClose={() => setSampleOpen(false)} />
    </div>
  );
}

export function Checkout({ ebookId }) {
  const { site, currency, pricing, setCurrency } = useSite();
  const toast = useToast();
  const ebook = (site.ebooks || []).find((book) => book.id === ebookId);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(() => {
    try {
      return (new URLSearchParams(window.location.search).get("code") || "").toUpperCase();
    } catch {
      return "";
    }
  });
  const [coupon, setCoupon] = useState(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [method, setMethod] = useState("");
  const [withBump, setWithBump] = useState(false);
  const autoCode = useRef(false);
  const bump = site.bump && ebook && site.bump.id !== ebook.id ? site.bump : null;
  const subtotal = (ebook ? Number(ebook.price) || 0 : 0) + (withBump && bump ? bump.price : 0);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("nbd:buyer") || "{}");
      if (saved.email) setForm((current) => ({ ...current, ...saved }));
    } catch {
      /* ignore */
    }
  }, []);

  // A coupon link (?code=XYZ) applies itself once, so a campaign never loses the
  // discount to a forgotten copy-paste.
  useEffect(() => {
    if (autoCode.current || !ebook || !code || site.features?.coupons === false) return;
    autoCode.current = true;
    let alive = true;
    api("/api/coupons/validate", { method: "POST", body: { code, amount: subtotal } })
      .then((result) => {
        if (!alive) return;
        setCoupon(result);
        toast(`${result.code} applied — ${result.label}`);
      })
      .catch((err) => {
        if (alive) toast(err.message, "bad");
      });
    return () => {
      alive = false;
    };
  }, [ebook && ebook.id]);

  if (!ebook) {
    return (
      <div className="page wrap">
        <Empty
          title="Checkout expired"
          text="Pick the ebook again from the library."
          action={<Link to="/ebooks" className="btn btn-primary">Back to library</Link>}
        />
      </div>
    );
  }

  const payment = site.settings.payment || {};
  const gateway = site.payment || {};
  const total = coupon ? coupon.total : subtotal;
  const methods = methodsForCurrency({ ...payment, ...gateway }, currency);
  const activeMethod = methods.find((row) => row.id === method) || methods[0] || null;

  async function applyCode() {
    if (!code.trim()) return;
    setCodeBusy(true);
    try {
      const result = await api("/api/coupons/validate", { method: "POST", body: { code, amount: subtotal } });
      setCoupon(result);
      toast(`${result.code} applied — ${result.label}`);
    } catch (err) {
      setCoupon(null);
      toast(err.message, "bad");
    } finally {
      setCodeBusy(false);
    }
  }

  async function toggleBump(next) {
    setWithBump(next);
    if (!coupon) return;
    try {
      const result = await api("/api/coupons/validate", {
        method: "POST",
        body: {
          code: coupon.code,
          amount: (Number(ebook.price) || 0) + (next && bump ? bump.price : 0),
        },
      });
      setCoupon(result);
    } catch (err) {
      setCoupon(null);
      toast(`${err.message} Remove the add-on, or apply the code again without it.`, "bad");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!agree) {
      setError("Please accept the licence to continue.");
      return;
    }
    setBusy(true);
    try {
      window.localStorage.setItem("nbd:buyer", JSON.stringify(form));
      const result = await api("/api/orders", {
        method: "POST",
        body: {
          ...form,
          ebookId: ebook.id,
          kind: "ebook",
          bumpId: withBump && bump ? bump.id : "",
          code: coupon ? coupon.code : "",
          currency,
          method: activeMethod ? activeMethod.id : "",
        },
      });
      rememberOrder(result.ref, form.email);
      if (result.warning) toast(result.warning, "bad");
      const mode = startPayment(result, form.email);
      if (!["payu", "paypal", "stripe"].includes(mode)) setBusy(false);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page checkout-page">
      <div className="wrap checkout-grid">
        <div className="checkout-main">
          <div className="crumbs">
            <Link to={`/ebooks/${ebook.slug}`}>← Back to {ebook.title}</Link>
          </div>
          <h1>
            Almost <em>yours.</em>
          </h1>
          <p className="muted">
            Pay the exact amount shown in {currency || "INR"}. The moment the gateway confirms it, your PDF
            unlocks here and lands in your inbox with a receipt.
          </p>
          <form onSubmit={submit} className="checkout-form">
            <Field label="Your name">
              <Input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Aditi Sharma"
                autoComplete="name"
              />
            </Field>
            <Field label="Email" hint="Your access and order lookup are tied to this email.">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Phone / WhatsApp">
              <Input
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+91 98xxxxxxxx"
                autoComplete="tel"
              />
            </Field>
            {bump ? (
              <label className={`bump-card${withBump ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={withBump}
                  onChange={(event) => toggleBump(event.target.checked)}
                />
                <Cover ebook={bump} />
                <span className="bump-copy">
                  <strong>{bump.heading}</strong>
                  <span>
                    {bump.title} · {money(bump.price)}
                  </span>
                  {bump.note ? <small>{bump.note}</small> : null}
                </span>
              </label>
            ) : null}
            {site.features?.coupons ? (
              <div className="coupon-row">
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                />
                <Button type="button" variant="secondary" onClick={applyCode} loading={codeBusy}>
                  Apply
                </Button>
              </div>
            ) : null}
            {coupon ? <p className="field-hint">✓ {coupon.code} · {coupon.label}</p> : null}
            {pricing?.currencies?.length ? (
              <div className="pay-currency">
                <span>Prices in</span>
                <select value={currency || "INR"} onChange={(event) => setCurrency(event.target.value)} aria-label="Currency">
                  {pricing.currencies.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.code} · {row.symbol}
                    </option>
                  ))}
                </select>
                <small>You are charged exactly what is shown.</small>
              </div>
            ) : null}
            {methods.length ? (
              <div className="pay-methods" role="radiogroup" aria-label="Payment method">
                {methods.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    role="radio"
                    aria-checked={(activeMethod ? activeMethod.id : "") === row.id}
                    className={`pay-method${(activeMethod ? activeMethod.id : "") === row.id ? " on" : ""}`}
                    onClick={() => setMethod(row.id)}
                  >
                    <strong>{row.label}</strong>
                    <small>{row.note}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="field-hint">
                Automatic checkout is not connected yet — add PayPal or PayU keys in Admin → Payments.
              </p>
            )}
            <label className="check-line">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
              <span>
                I accept the <Link to="/policies">personal licence</Link> — this copy is for me, not for
                resale.
              </span>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" size="lg" loading={busy} className="btn-block">
              Pay {money(total)}{activeMethod ? ` with ${activeMethod.label}` : " securely"} →
            </Button>
            <p className="check-fine">
              {activeMethod
                ? `${activeMethod.label} · ${activeMethod.note}. We never see or store your card details.`
                : "Connect a payment gateway in Admin → Payments to take automatic payments."}
            </p>
            <p className="check-fine">✿ PDF + receipt emailed the moment payment is confirmed.</p>
          </form>
        </div>
        <aside className="checkout-summary">
          <span className="eyebrow">order summary</span>
          <div className="summary-item">
            <Cover ebook={ebook} />
            <div>
              <strong>{ebook.title}</strong>
              <span>{ebook.subtitle}</span>
              <small>PDF · {ebook.pages || "short"} pages</small>
            </div>
          </div>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{money(ebook.price)}</span>
          </div>
          {withBump && bump ? (
            <div className="summary-row">
              <span>Add-on · {bump.title}</span>
              <span>{money(bump.price)}</span>
            </div>
          ) : null}
          <div className="summary-row">
            <span>Delivery</span>
            <span>Instant · free</span>
          </div>
          {coupon ? (
            <div className="summary-row">
              <span>Coupon {coupon.code}</span>
              <span>−{money(coupon.discount)}</span>
            </div>
          ) : null}
          <div className="summary-total">
            <span>Total {currency ? `(${currency})` : ""}</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="summary-perks">
            <span>✿ Yours forever</span>
            <span>✿ PDF emailed + download here</span>
            <span>✿ 100% refund promise</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function OrderPage({ reference }) {
  const { site } = useSite();
  const path = usePath();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [utr, setUtr] = useState("");
  const [paying, setPaying] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [refundForm, setRefundForm] = useState({ preference: "material", reason: "" });
  const ref = decodeURIComponent(reference || "");
  const query = useMemo(() => new URLSearchParams(path.split("?")[1] || ""), [path]);

  useEffect(() => {
    const fromQuery = query.get("email") || "";
    const stored = recallOrder(ref);
    const initial = fromQuery || stored;
    if (initial) {
      setEmail(initial);
      load(initial);
    }
  }, [ref]);

  async function load(mail, quiet = false) {
    if (!mail) return;
    if (!quiet) setBusy(true);
    try {
      const result = await api(`/api/orders/${encodeURIComponent(ref)}?email=${encodeURIComponent(mail)}`);
      setData(result);
      rememberOrder(ref, mail);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="page wrap narrow">
        <div className="panel lookup-panel">
          <span className="eyebrow">order lookup</span>
          <h1>
            Find your <em>order.</em>
          </h1>
          <p className="muted">Enter the email you used at checkout for {ref}.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              load(email);
            }}
          >
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                required
              />
            </Field>
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" loading={busy} className="btn-block">
              Open my order
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const order = data.order;
  const paid = order.status === "paid";
  const payFlag = query.get("pay");
  const reason = query.get("reason");
  const methods = data.payment?.methods || [];
  const orderMoney = formatPrice(
    order.amountCharged || order.amount,
    currencyConfigFor(order.currency || "INR", site.pricing)
  );

  async function payWith(methodId) {
    setPaying(methodId);
    try {
      const result = await api(`/api/orders/${encodeURIComponent(ref)}/pay`, {
        method: "POST",
        body: { email, method: methodId },
      });
      if (result.paid) {
        toast("Payment already confirmed — access unlocked.");
        await load(email, true);
        return;
      }
      startPayment(result, email);
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setPaying("");
    }
  }

  async function submitUtr(event) {
    event.preventDefault();
    try {
      await api(`/api/orders/${encodeURIComponent(ref)}/claim`, {
        method: "POST",
        body: { email, utr },
      });
      toast("Payment reference sent. Access unlocks once verified.");
      load(email, true);
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function submitRefund(event) {
    event.preventDefault();
    try {
      await api("/api/refunds", {
        method: "POST",
        body: { orderRef: ref, email, ...refundForm },
      });
      toast("Request received. We'll reply by email.");
      setShowRefund(false);
      load(email, true);
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="page wrap narrow order-page">
      {payFlag === "success" ? (
        <div className="pay-banner success">
          <strong>Payment received.</strong> Your PDF is unlocking now and the download starts automatically.
          This page keeps the link, so you can download it again any time.
        </div>
      ) : null}
      {payFlag === "failed" ? (
        <div className="pay-banner failed">
          <strong>Payment did not complete.</strong>{" "}
          {reason === "hash_mismatch"
            ? "We could not verify the gateway response, so nothing was unlocked and nothing was charged twice — try again below."
            : "No access was unlocked and nothing was charged. You can retry the payment below."}
        </div>
      ) : null}
      <div className="order-head">
        <div>
          <span className="eyebrow">order {order.ref}</span>
          <h1>{order.title}</h1>
          <p className="muted">
            Placed {prettyDateTime(order.created_at)} · {orderMoney}
            {order.currency && order.currency !== "INR" ? ` (${order.currency})` : ""}
          </p>
          {order.discount ? (
            <p className="field-hint">
              Coupon {order.couponCode} saved {money(order.discount)}
            </p>
          ) : null}
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="order-grid">
        <div className="panel">
          <h3>Access</h3>
          {paid ? (
            <>
              <AutoDownload url={order.items?.[0]?.downloadUrl || order.downloadUrl} orderRef={order.ref} />
              <p className="muted">
                Yours forever. The download starts on its own — if your browser blocks it, use the button below.
                Re-download any time from this page; the link stays live.
              </p>
              {order.items?.length ? (
                <div className="download-list">
                  {order.items.map((item) => (
                    <a key={item.id} className="download-row" href={item.downloadUrl}>
                      <span>{item.title}</span>
                      <strong>Download PDF ↓</strong>
                    </a>
                  ))}
                </div>
              ) : (
                <a className="btn btn-primary btn-lg btn-block" href={order.downloadUrl}>
                  Download PDF ↓
                </a>
              )}
              {order.receiptUrl ? (
                <a className="btn btn-ghost btn-sm" href={order.receiptUrl}>
                  Download receipt
                </a>
              ) : null}
              <p className="field-hint">Downloaded {order.downloads} time(s) · {order.email}</p>
              <p className="field-hint">
                {data.payment?.emailSent
                  ? `✿ PDF + receipt emailed to ${order.email}.`
                  : "Your PDF is available here. Add a mail key in Admin → Payments to also email it automatically."}
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                Complete the payment to unlock the PDF. Nothing is charged twice — this order stays pending
                until a verified payment arrives.
              </p>
              {data.ebook ? (
                <p className="field-hint">
                  You'll receive: {data.ebook.title} · PDF · {data.ebook.pages || "short"} pages
                </p>
              ) : null}
            </>
          )}
          <div className="order-actions">
            <Link to="/support" className="btn btn-ghost btn-sm">
              Need help?
            </Link>
            {site.settings.telegram ? (
              <a
                className="btn btn-ghost btn-sm"
                href={`https://t.me/${String(site.settings.telegram).replace(/^@/, "")}?text=${encodeURIComponent(
                  `Hi Neverbasic Diva, I need help with order ${order.ref}.`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Telegram support
              </a>
            ) : null}
            {paid ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRefund(true)}>
                Refund / not satisfied
              </button>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <h3>Payment</h3>
          <dl className="kv">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusPill status={order.status} />
              </dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{order.paymentMode || "—"}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{order.utr || order.ref}</dd>
            </div>
            <div>
              <dt>Paid on</dt>
              <dd>{order.paid_at ? prettyDateTime(order.paid_at) : "—"}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{orderMoney}{order.currency && order.currency !== "INR" ? ` (${order.currency})` : ""}</dd>
            </div>
          </dl>
          {!paid && methods.length ? (
            <div className="pay-now">
              <p className="field-hint">
                Pay exactly {orderMoney} — nothing unlocks until the gateway confirms the payment itself.
              </p>
              {methods.map((row, index) => (
                <Button
                  key={row.id}
                  className="btn-block"
                  variant={index === 0 ? "primary" : "secondary"}
                  loading={paying === row.id}
                  onClick={() => payWith(row.id)}
                >
                  Pay {orderMoney} with {row.label}
                </Button>
              ))}
              <p className="field-hint">Your order reference stays the same — no duplicate charge.</p>
            </div>
          ) : null}
          {!paid && !methods.length && (data.payment?.link || data.payment?.upi) ? (
            <div className="pay-now">
              {data.payment?.link ? (
                <a className="btn btn-primary btn-block" href={data.payment.link} target="_blank" rel="noreferrer">
                  Pay {orderMoney} on the secure link →
                </a>
              ) : null}
              {data.payment?.upi ? (
                <div className="upi-line">
                  <span>UPI ID</span>
                  <code>{data.payment.upi}</code>
                  <CopyButton value={data.payment.upi} label="Copy UPI" />
                </div>
              ) : null}
              {data.payment?.instructions ? <p className="field-hint">{data.payment.instructions}</p> : null}
              <form onSubmit={submitUtr} className="utr-form">
                <Field
                  label="Paste UTR / transaction reference"
                  hint="Only needed for a UPI transfer. Gateway payments unlock automatically."
                >
                  <Input value={utr} onChange={(event) => setUtr(event.target.value)} placeholder="e.g. 423187654321" />
                </Field>
                <Button type="submit" variant="secondary" size="sm">
                  Submit for verification
                </Button>
              </form>
            </div>
          ) : null}
          {data.refund ? (
            <p className="field-hint">
              Refund request {data.refund.ref} · <StatusPill status={data.refund.status} />
            </p>
          ) : null}
        </div>
      </div>

      {order.kind === "resell" && data.reseller ? (
        <div className="panel reseller-license">
          <span className="eyebrow">your resell licence</span>
          <div className="license-grid">
            <div>
              <small>Reseller code</small>
              <strong>{data.reseller.code}</strong>
            </div>
            <div>
              <small>Valid until</small>
              <strong>{new Date(data.reseller.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
            </div>
            <div>
              <small>Status</small>
              <StatusPill status={data.reseller.status} />
            </div>
          </div>
          <p className="muted">
            Share your link with <code>?res={data.reseller.code}</code> to track the clicks you bring in.
            Open the reseller portal to download the files you're licensed to sell.
          </p>
          <Link to="/resell/portal" className="btn btn-secondary">
            Open reseller portal →
          </Link>
        </div>
      ) : null}

      <div className="panel">
        <h3>Order timeline</h3>
        <ul className="timeline">
          {(data.events || []).map((event, index) => (
            <li key={index}>
              <span className="dot" />
              <div>
                <strong>{String(event.type).replace(/_/g, " ")}</strong>
                <small>{prettyDateTime(event.created_at)}</small>
                {event.message ? <p>{event.message}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {paid && order.canReview && site.features?.reviews ? (
        <div className="panel">
          <h3>Leave a verified review</h3>
          <p className="muted">Only buyers of this order can review. It shows up once approved.</p>
          {(order.items?.length ? order.items : data.ebook ? [{ id: data.ebook.id, title: data.ebook.title }] : []).map((item) => (
            <ReviewForm
              key={item.id}
              ebookId={item.id}
              ebookTitle={item.title}
              orderRef={order.ref}
              email={email}
            />
          ))}
        </div>
      ) : null}

      {paid && site.features?.upsell ? (
        <section className="order-upsell">
          <div className="section-head">
            <div>
              <span className="eyebrow">stack the next one</span>
              <h2>
                One more that <em>compounds.</em>
              </h2>
            </div>
          </div>
          <div className="masonry">
            {(site.ebooks || [])
              .filter((book) => !(order.items || []).some((item) => item.id === book.id))
              .slice(0, 3)
              .map((book, index) => (
                <EbookCard key={book.id} ebook={book} index={index} />
              ))}
          </div>
        </section>
      ) : null}

      <p className="order-foot">
        Keep this reference: <strong>{order.ref}</strong> · Look it up any time at{" "}
        <Link to="/track">My order</Link>.
      </p>

      <Modal
        open={showRefund}
        title="Not satisfied? We'll fix it."
        onClose={() => setShowRefund(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRefund(false)}>
              Cancel
            </Button>
            <Button onClick={submitRefund}>Send request</Button>
          </>
        }
      >
        <p className="muted">
          First we'll send material matched to what you actually wanted. If it still doesn't work, we refund
          100%.
        </p>
        <Field label="What would help most?">
          <select
            className="input select"
            value={refundForm.preference}
            onChange={(event) => setRefundForm({ ...refundForm, preference: event.target.value })}
          >
            <option value="material">Send me better-matched material</option>
            <option value="refund">I want a refund</option>
            <option value="both">Either — whatever gets me the answer</option>
          </select>
        </Field>
        <Field label="What didn't land?">
          <Textarea
            rows={4}
            value={refundForm.reason}
            onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })}
            placeholder="I wanted practical scripts for negotiating rent, this was too general…"
          />
        </Field>
      </Modal>
    </div>
  );
}

// The PDF starts downloading by itself the moment a verified payment lands on
// the order page. Browsers can block the first automatic file, so the page keeps
// the visible button right beside it. One attempt per order per browser session.
function AutoDownload({ url, orderRef }) {
  useEffect(() => {
    if (!url) return undefined;
    const key = `nbd:autodownload:${orderRef}`;
    try {
      if (window.sessionStorage.getItem(key)) return undefined;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* private mode */
    }
    const timer = window.setTimeout(() => {
      window.location.href = url;
    }, 700);
    return () => window.clearTimeout(timer);
  }, [url, orderRef]);
  return null;
}

export function TrackPage() {
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="page wrap narrow">
      <div className="panel lookup-panel">
        <span className="eyebrow">my order</span>
        <h1>
          Everything you <em>bought.</em>
        </h1>
        <p className="muted">
          Enter your order reference (it starts with NBD-) and the email you used. Your PDF, timeline and
          support live there.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/order/${encodeURIComponent(ref.trim())}?email=${encodeURIComponent(email.trim())}`);
          }}
        >
          <Field label="Order reference">
            <Input value={ref} onChange={(event) => setRef(event.target.value)} placeholder="NBD-260101-AB12CD" required />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              required
            />
          </Field>
          <Button type="submit" className="btn-block">
            Open my order →
          </Button>
        </form>
        <p className="field-hint">
          Lost the reference? Use the support form with your email and we'll find it for you.
        </p>
      </div>
    </div>
  );
}
