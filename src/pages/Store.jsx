import React, { useEffect, useMemo, useState } from "react";
import {
  api,
  Link,
  money,
  navigate,
  prettyDateTime,
  recallOrder,
  rememberOrder,
  usePath,
  useSite,
} from "../lib/api.jsx";
import { startPayment } from "../lib/pay.jsx";
import {
  Button,
  Chip,
  CopyButton,
  Cover,
  Empty,
  Field,
  Input,
  Modal,
  Reveal,
  Spinner,
  StatusPill,
  Textarea,
  useToast,
} from "../ui.jsx";
import EbookCard from "./EbookCard.jsx";

export function Shop() {
  const { site } = useSite();
  const [category, setCategory] = useState("All");
  const ebooks = site.ebooks || [];
  const categories = ["All", ...Array.from(new Set(ebooks.map((book) => book.category).filter(Boolean)))];
  const list = category === "All" ? ebooks : ebooks.filter((book) => book.category === category);

  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">the full library</span>
          <h1>
            Read it tonight, <em>use it tomorrow.</em>
          </h1>
          <p>
            Every ebook is short, specific and priced like a snack. Instant PDF access the moment payment
            clears — plus a lifetime order page you can return to.
          </p>
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
      </div>
    </div>
  );
}

export function EbookPage({ slug }) {
  const { site } = useSite();
  const ebook = (site.ebooks || []).find((book) => book.slug === slug);
  const others = (site.ebooks || []).filter((book) => book.slug !== slug).slice(0, 3);

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
            <div className="detail-cover">
              <Cover ebook={ebook} lazy={false} />
              {ebook.badge ? <span className="card-badge">{ebook.badge}</span> : null}
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
            </Reveal>
            <Reveal delay={80} className="detail-price-row">
              <span className="detail-price">{money(ebook.price)}</span>
              {ebook.mrp > ebook.price ? <s>{money(ebook.mrp)}</s> : null}
              {discount ? <Chip tone="accent">{discount}% off</Chip> : null}
              <span className="price-compare">≈ one cup of chai</span>
            </Reveal>
            <Reveal delay={120}>
              <p className="detail-desc">{ebook.description}</p>
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
            <Reveal delay={200} className="buy-box">
              <div className="buy-box-top">
                <div>
                  <span className="buy-label">Instant download</span>
                  <strong>{money(ebook.price)}</strong>
                </div>
                <Link to={`/checkout/${ebook.id}`} className="btn btn-primary btn-lg">
                  Get it now →
                </Link>
              </div>
              <p className="buy-fine">
                Pay by UPI, card or netbanking. Your PDF unlocks immediately and stays on your order page
                forever.
              </p>
              <div className="buy-trust">
                <span>✿ 100% refund promise</span>
                <span>✿ No subscription</span>
                <span>✿ Personal licence</span>
              </div>
            </Reveal>
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
      </div>
    </div>
  );
}

export function Checkout({ ebookId }) {
  const { site } = useSite();
  const toast = useToast();
  const ebook = (site.ebooks || []).find((book) => book.id === ebookId);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("nbd:buyer") || "{}");
      if (saved.email) setForm((current) => ({ ...current, ...saved }));
    } catch {
      /* ignore */
    }
  }, []);

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
        body: { ...form, ebookId: ebook.id, kind: "ebook" },
      });
      rememberOrder(result.ref, form.email);
      if (result.warning) toast(result.warning, "bad");
      startPayment(result, form.email);
      if (result.mode !== "payu") setBusy(false);
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
            {payment.payu
              ? "You'll be taken to PayU's secure checkout. Your download unlocks the moment it verifies."
              : "Pay by UPI or the payment link, then paste the reference. Access unlocks after verification."}
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
            <label className="check-line">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
              <span>
                I accept the <Link to="/policies">personal licence</Link> — this copy is for me, not for
                resale.
              </span>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" size="lg" loading={busy} className="btn-block">
              Pay {money(ebook.price)} securely →
            </Button>
            <p className="check-fine">
              {payment.payu
                ? "PayU · UPI, cards, netbanking, wallets. We never store your payment details."
                : "Manual verification is used until the gateway is connected. Your access is guaranteed."}
            </p>
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
          <div className="summary-row">
            <span>Delivery</span>
            <span>Instant · free</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(ebook.price)}</strong>
          </div>
          <div className="summary-perks">
            <span>✿ Yours forever</span>
            <span>✿ 100% refund promise</span>
            <span>✿ Support replies in hours</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function OrderPage({ reference }) {
  const path = usePath();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [utr, setUtr] = useState("");
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
          <strong>Payment received.</strong> Your access is unlocked below. A copy of the download link
          stays on this page.
        </div>
      ) : null}
      {payFlag === "failed" ? (
        <div className="pay-banner failed">
          <strong>Payment did not complete.</strong>{" "}
          {reason === "hash_mismatch"
            ? "We could not verify the gateway response, so nothing was charged twice — try again or pay by UPI."
            : "No access was unlocked. You can retry or pay by UPI and submit the reference."}
        </div>
      ) : null}
      <div className="order-head">
        <div>
          <span className="eyebrow">order {order.ref}</span>
          <h1>{order.title}</h1>
          <p className="muted">
            Placed {prettyDateTime(order.created_at)} · {money(order.amount)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="order-grid">
        <div className="panel">
          <h3>Access</h3>
          {paid ? (
            <>
              <p className="muted">
                Yours forever. Re-download any time from this page — the link stays live.
              </p>
              <a className="btn btn-primary btn-lg btn-block" href={order.downloadUrl}>
                Download PDF ↓
              </a>
              <p className="field-hint">Downloaded {order.downloads} time(s) · {order.email}</p>
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
          </dl>
          {!paid ? (
            <div className="pay-now">
              {data.payment?.link ? (
                <a
                  className="btn btn-primary btn-block"
                  href={data.payment.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Pay {money(order.amount)} on the secure link →
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
            </div>
          ) : null}
          {!paid ? (
            <form onSubmit={submitUtr} className="utr-form">
              <Field
                label="Paste UTR / transaction reference"
                hint="Found in your UPI app under payment details. We verify manually, usually within a few hours."
              >
                <Input value={utr} onChange={(event) => setUtr(event.target.value)} placeholder="e.g. 423187654321" />
              </Field>
              <Button type="submit" variant="secondary" size="sm">
                Submit for verification
              </Button>
            </form>
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
