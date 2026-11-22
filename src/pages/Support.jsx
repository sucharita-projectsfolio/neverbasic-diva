import React, { useEffect, useState } from "react";
import { api, Link, money, prettyDateTime, useSite } from "../lib/api.jsx";
import { methodsForCurrency, startPayment } from "../lib/pay.jsx";
import {
  Button,
  Chip,
  Cover,
  CopyButton,
  Empty,
  Field,
  Input,
  Reveal,
  Select,
  Spinner,
  StatusPill,
  Textarea,
  useToast,
} from "../ui.jsx";

/* -------------------------------- support -------------------------------- */

export function SupportPage() {
  const { site } = useSite();
  const toast = useToast();
  const settings = site.settings;
  const [mode, setMode] = useState("new");
  const [form, setForm] = useState({ name: "", email: "", orderRef: "", subject: "Help with my order", message: "" });
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);

  const [lookup, setLookup] = useState({ ref: "", email: "" });
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  // Emails link straight into a thread: /support?ticket=TKT-…&email=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ticket");
    const mail = params.get("email");
    if (!ref || !mail) return;
    setLookup({ ref, email: mail });
    setMode("lookup");
    api(`/api/tickets/${encodeURIComponent(ref)}?email=${encodeURIComponent(mail)}`)
      .then((result) => setTicket({ ...result, email: mail }))
      .catch((err) => toast(err.message, "bad"));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/tickets", { method: "POST", body: form });
      setCreated(result.ref);
      toast("Sent. We'll reply to your email.");
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  async function openTicket(event) {
    event.preventDefault();
    setLookupBusy(true);
    try {
      const result = await api(
        `/api/tickets/${encodeURIComponent(lookup.ref.trim())}?email=${encodeURIComponent(lookup.email.trim())}`
      );
      setTicket({ ...result, email: lookup.email.trim() });
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setLookupBusy(false);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    try {
      await api(`/api/tickets/${encodeURIComponent(ticket.ticket.ref)}/reply`, {
        method: "POST",
        body: { email: ticket.email, body: reply },
      });
      setReply("");
      const fresh = await api(
        `/api/tickets/${encodeURIComponent(ticket.ticket.ref)}?email=${encodeURIComponent(ticket.email)}`
      );
      setTicket({ ...fresh, email: ticket.email });
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="page wrap">
      <header className="page-head">
        <span className="eyebrow">help &amp; support</span>
        <h1>
          Real replies. <em>Real fast.</em>
        </h1>
        <p>
          Missing a download, payment confusion, or you just want something more specific — write here.
          Every message lands with a human.
        </p>
      </header>

      <div className="support-grid">
        <div className="panel">
          <div className="tabs">
            <button type="button" className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>
              New request
            </button>
            <button type="button" className={mode === "lookup" ? "active" : ""} onClick={() => setMode("lookup")}>
              Check a reply
            </button>
          </div>

          {mode === "new" ? (
            created ? (
              <div className="success-card">
                <div className="success-mark">✿</div>
                <h3>Your request is in.</h3>
                <p className="muted">
                  Save this ticket reference — replies appear on this ticket page the moment we answer.
                </p>
                <div className="ticket-ref">
                  <code>{created}</code>
                  <CopyButton value={created} />
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setLookup({ ref: created, email: form.email });
                      setMode("lookup");
                    }}
                  >
                    Check replies
                  </button>
                  <Link to="/ebooks" className="btn btn-ghost">
                    Back to library
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="stack">
                <div className="two-col">
                  <Field label="Your name">
                    <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="two-col">
                  <Field label="Order reference (optional)">
                    <Input
                      value={form.orderRef}
                      onChange={(e) => setForm({ ...form, orderRef: e.target.value })}
                      placeholder="NBD-…"
                    />
                  </Field>
                  <Field label="Topic">
                    <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                      <option>Help with my order</option>
                      <option>Download not working</option>
                      <option>Payment / refund question</option>
                      <option>Resell licence question</option>
                      <option>Something else</option>
                    </Select>
                  </Field>
                </div>
                <Field label="What's going on?">
                  <Textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us exactly what you need — the more specific, the faster we can fix it."
                  />
                </Field>
                <Button type="submit" loading={busy}>
                  Send to support →
                </Button>
                <p className="field-hint">
                  Prefer email? {settings.support_email} · Instagram @{settings.instagram}
                </p>
              </form>
            )
          ) : ticket ? (
            <div className="thread">
              <div className="thread-head">
                <div>
                  <span className="eyebrow">ticket {ticket.ticket.ref}</span>
                  <h3>{ticket.ticket.subject}</h3>
                </div>
                <StatusPill status={ticket.ticket.status} />
              </div>
              <div className="messages">
                {ticket.messages.map((message, index) => (
                  <div key={index} className={`message ${message.author === "admin" ? "from-admin" : "from-customer"}`}>
                    <span className="message-author">{message.author === "admin" ? "Neverbasic Diva" : "You"}</span>
                    <p>{message.body}</p>
                    <small>{prettyDateTime(message.created_at)}</small>
                  </div>
                ))}
              </div>
              <form onSubmit={sendReply} className="reply-box">
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Add anything else…"
                />
                <Button type="submit" size="sm" disabled={!reply.trim()}>
                  Send reply
                </Button>
              </form>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTicket(null)}>
                ← Check another ticket
              </button>
            </div>
          ) : (
            <form onSubmit={openTicket} className="stack">
              <Field label="Ticket reference">
                <Input
                  required
                  value={lookup.ref}
                  onChange={(e) => setLookup({ ...lookup, ref: e.target.value })}
                  placeholder="TKT-ABC123"
                />
              </Field>
              <Field label="Email used">
                <Input
                  required
                  type="email"
                  value={lookup.email}
                  onChange={(e) => setLookup({ ...lookup, email: e.target.value })}
                />
              </Field>
              <Button type="submit" loading={lookupBusy}>
                Open conversation
              </Button>
            </form>
          )}
        </div>

        <aside className="support-aside">
          <div className="aside-card">
            <h4>Response time</h4>
            <p>Usually within a few hours, always under 24. Payment or access issues jump the queue.</p>
          </div>
          <div className="aside-card">
            <h4>Want something specific?</h4>
            <p>If an ebook doesn't cover your exact question, ask for it. We build custom material on request.</p>
            <Link to="/request" className="link-underline">
              Request an ebook →
            </Link>
          </div>
          <div className="aside-card accent">
            <h4>The refund promise</h4>
            <p>Not satisfied? Tell us what you needed. We send better-matched material, and if it still misses, 100% refund.</p>
            <Link to="/refund" className="link-underline">
              Read the promise →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------- request -------------------------------- */

export function RequestPage() {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", topic: "", budget: "₹99–₹299", message: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/requests", { method: "POST", body: form });
      setSent(true);
      toast("Request received.");
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page wrap narrow">
      <header className="page-head">
        <span className="eyebrow">request an ebook</span>
        <h1>
          Tell us what you wish <em>someone had told you.</em>
        </h1>
        <p>
          A situation you're stuck in, a conversation you keep losing, a number you don't know how to ask
          for. If enough people ask, it becomes an ebook — and you get it first.
        </p>
      </header>
      {sent ? (
        <div className="panel success-card">
          <div className="success-mark">✿</div>
          <h3>Got it. This one's noted.</h3>
          <p className="muted">
            We read every request. If it becomes an ebook, we'll reach you at {form.email} first.
          </p>
          <Link to="/ebooks" className="btn btn-primary">
            Browse what's live now
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="panel stack">
          <div className="two-col">
            <Field label="Name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <div className="two-col">
            <Field label="WhatsApp (optional)">
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </Field>
            <Field label="Theme">
              <Select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}>
                <option>₹99–₹299</option>
                <option>₹299–₹999</option>
                <option>₹999+</option>
                <option>Not sure yet</option>
              </Select>
            </Field>
          </div>
          <Field label="One-line topic">
            <Input
              required
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="How to ask for a raise without freezing"
            />
          </Field>
          <Field label="The full picture">
            <Textarea
              required
              rows={6}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="What's the situation? What have you already tried? What would a win look like?"
            />
          </Field>
          <Button type="submit" loading={busy}>
            Send my request →
          </Button>
          <p className="field-hint">We reply to every serious request. No spam, no sales calls.</p>
        </form>
      )}
    </div>
  );
}

/* -------------------------------- refund -------------------------------- */

export function RefundPage() {
  const { site } = useSite();
  const toast = useToast();
  const [form, setForm] = useState({ orderRef: "", email: "", preference: "material", reason: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api("/api/refunds", { method: "POST", body: form });
      setResult(data);
      toast("Request received.");
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page wrap">
      <header className="page-head">
        <span className="eyebrow">the refund promise</span>
        <h1>
          If it doesn't land, <em>it's on us.</em>
        </h1>
        <p>{site.settings.refund_policy}</p>
      </header>

      <div className="refund-grid">
        <div className="refund-flow">
          {[
            ["You tell us what missed", "The topic, the tone, the level — whatever it was. One honest paragraph."],
            ["We send material matched to it", "A different ebook, a focused brief, or custom pages built around your question."],
            ["Still not it? 100% refund", "Approved refunds go back to the original payment method. No store credit, no arguments."],
          ].map(([title, text], index) => (
            <Reveal key={title} delay={index * 80} className="refund-step">
              <span className="step-num">{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </Reveal>
          ))}
          <p className="field-hint">
            Requests are accepted within {site.settings.refund_window_days || 3} days of purchase, and any
            time after that if the file itself is broken or inaccessible.
          </p>
        </div>

        {result ? (
          <div className="panel success-card">
            <div className="success-mark">✿</div>
            <h3>Request logged.</h3>
            <p className="muted">
              Reference <strong>{result.ref}</strong>. We review requests the same day and reply to your
              email with the matched material or refund confirmation.
            </p>
            <Link to="/support" className="btn btn-secondary">
              Add more detail
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="panel stack">
            <h3>Open a request</h3>
            <Field label="Order reference">
              <Input
                required
                value={form.orderRef}
                onChange={(e) => setForm({ ...form, orderRef: e.target.value })}
                placeholder="NBD-…"
              />
            </Field>
            <Field label="Email used at checkout">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="What would you prefer?">
              <Select value={form.preference} onChange={(e) => setForm({ ...form, preference: e.target.value })}>
                <option value="material">Send me better-matched material</option>
                <option value="refund">100% refund</option>
                <option value="both">Either — whatever gets me the answer</option>
              </Select>
            </Field>
            <Field label="What didn't work for you?">
              <Textarea
                required
                rows={5}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Be specific — it helps us send the right thing."
              />
            </Field>
            <Button type="submit" loading={busy}>
              Send request
            </Button>
            <p className="field-hint">No order found? Use the support form and we'll trace it by email.</p>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- policies ------------------------------- */

export function PoliciesPage() {
  const { site } = useSite();
  const s = site.settings;
  const blocks = [
    ["Licence", s.license_terms],
    ["Terms of use", s.terms],
    ["Privacy", s.privacy],
    ["Refunds", s.refund_policy],
  ];
  return (
    <div className="page wrap narrow">
      <header className="page-head">
        <span className="eyebrow">the fine print, in plain language</span>
        <h1>
          Rules of the <em>house.</em>
        </h1>
      </header>
      <div className="panel policy-body">
        {blocks.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>
            Email {s.support_email} · Instagram @{s.instagram}. For anything urgent about a payment, use the{" "}
            <Link to="/support">support form</Link> with your order reference.
          </p>
        </section>
      </div>
    </div>
  );
}

/* --------------------------------- resell -------------------------------- */

export function ResellPage() {
  const { site, currency, pricing, setCurrency } = useSite();
  const toast = useToast();
  const settings = site.settings;
  const [form, setForm] = useState({ name: "", email: "", phone: "", instagram: "", audience: "Under 1k" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("");
  const price = Number(settings.resell_price || 399);
  const methods = methodsForCurrency({ ...(settings.payment || {}), ...(site.payment || {}) }, currency);
  const activeMethod = methods.find((row) => row.id === method) || methods[0] || null;

  async function submit(event) {
    event.preventDefault();
    if (!agree) {
      toast("Please accept the resell licence terms.", "bad");
      return;
    }
    setBusy(true);
    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: { ...form, kind: "resell", currency, method: activeMethod ? activeMethod.id : "" },
      });
      const mode = startPayment(result, form.email);
      if (!["payu", "paypal", "stripe", "razorpay"].includes(mode)) setBusy(false);
    } catch (err) {
      toast(err.message, "bad");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="resell-hero">
        <div className="wrap resell-hero-grid">
          <div>
            <span className="eyebrow light">resell rights · 1 year · one-time</span>
            <h1>
              Sell the words. <em>Keep the money.</em>
            </h1>
            <p>
              You don't need a course, a funnel or 50k followers. You need something genuinely useful to
              share and a licence that makes it yours to sell. That's this.
            </p>
            <div className="resell-hero-facts">
              <div>
                <strong>₹{price}</strong>
                <span>one-time fee</span>
              </div>
              <div>
                <strong>365</strong>
                <span>days of licence</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>of sales stay with you</span>
              </div>
            </div>
          </div>
          <div className="resell-apply panel">
            <h3>Get your licence</h3>
            <p className="field-hint">Takes a minute. Licence activates after payment verifies.</p>
            <form onSubmit={submit} className="stack">
              <Field label="Full name">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <div className="two-col">
                <Field label="WhatsApp">
                  <Input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91…"
                  />
                </Field>
                <Field label="Instagram">
                  <Input
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                    placeholder="@yourpage"
                  />
                </Field>
              </div>
              <Field label="Audience size">
                <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  <option>Under 1k</option>
                  <option>1k–5k</option>
                  <option>5k–20k</option>
                  <option>20k+</option>
                </Select>
              </Field>
              <label className="check-line">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  I accept the <Link to="/policies">resell licence</Link> — I can sell these ebooks for one
                  year, but I won't claim authorship or share raw files.
                </span>
              </label>
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
              ) : null}
              <Button type="submit" size="lg" loading={busy} className="btn-block">
                Pay {money(price)}{activeMethod ? ` with ${activeMethod.label}` : ""} &amp; activate →
              </Button>
            </form>
            <p className="field-hint">
              Already licensed? <Link to="/resell/portal">Open the reseller portal →</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">how people actually do it</span>
            <h2>
              Three posts. <em>One licence.</em>
            </h2>
          </div>
          <div className="value-grid three">
            {[
              ["Reel or story", "Show one line that hit you. Link your resellers page or take DMs."],
              ["Name your price", "₹99, ₹149, ₹299 — whatever feels right. You keep all of it."],
              ["Deliver instantly", "Send the PDF after payment. Your code tracks every click you bring."],
            ].map(([title, text], index) => (
              <Reveal key={title} delay={index * 70} className="value-card">
                <span className="value-mark">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
          <div className="resell-terms panel">
            <h3>What the licence allows</h3>
            <div className="terms-grid">
              <div>
                <h4>You can</h4>
                <ul className="tick-list">
                  <li>Sell every ebook to your own audience</li>
                  <li>Set your own price and keep 100%</li>
                  <li>Promote on reels, stories, WhatsApp, newsletters</li>
                  <li>Download the source PDFs from the portal</li>
                </ul>
              </div>
              <div>
                <h4>You can't</h4>
                <ul className="cross-list">
                  <li>Claim you wrote the ebooks</li>
                  <li>Share the raw files publicly or in groups</li>
                  <li>Sell after your 1-year licence ends</li>
                  <li>Alter the brand or remove watermarks</li>
                </ul>
              </div>
            </div>
            <p className="field-hint">
              {settings.resell_commission_note} Renewal is optional and costs the same ₹{price}.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PortalPage() {
  const toast = useToast();
  const [form, setForm] = useState({ code: "", email: "" });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/reseller/lookup", { method: "POST", body: form });
      setData(result);
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page wrap narrow">
      <header className="page-head">
        <span className="eyebrow">reseller portal</span>
        <h1>
          Your licence, <em>your files.</em>
        </h1>
        <p>Enter your reseller code and email to download everything you're licensed to sell.</p>
      </header>

      {!data ? (
        <form onSubmit={submit} className="panel stack">
          <Field label="Reseller code">
            <Input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="DIVA-AB12"
            />
          </Field>
          <Field label="Email on the licence">
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Button type="submit" loading={busy}>
            Open my licence
          </Button>
          <p className="field-hint">
            No licence yet? <Link to="/resell">Resell rights are ₹399 for a year →</Link>
          </p>
        </form>
      ) : data.status !== "active" ? (
        <div className="panel success-card">
          <div className="success-mark">✿</div>
          <h3>This licence is {data.status}</h3>
          <p className="muted">
            Reseller code {data.reseller?.code}. If you think this is a mistake, message support with your
            order reference.
          </p>
          <Link to="/resell" className="btn btn-primary">
            Renew for another year
          </Link>
        </div>
      ) : (
        <div className="stack">
          <div className="panel">
            <div className="license-grid">
              <div>
                <small>Licence</small>
                <strong>{data.reseller.code}</strong>
                <CopyButton value={data.reseller.code} />
              </div>
              <div>
                <small>Valid until</small>
                <strong>
                  {new Date(data.reseller.expires_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </div>
              <div>
                <small>Clicks / sales</small>
                <strong>
                  {data.reseller.clicks} / {data.reseller.sales}
                </strong>
              </div>
              <div>
                <small>Status</small>
                <StatusPill status={data.reseller.status} />
              </div>
            </div>
            <p className="field-hint">
              Tracked link: <code>{`${window.location.origin}/?res=${data.reseller.code}`}</code>
            </p>
          </div>

          <div className="section-head">
            <div>
              <span className="eyebrow">your sellable library</span>
              <h2>
                Download &amp; <em>start selling.</em>
              </h2>
            </div>
          </div>
          {data.ebooks.length ? (
            <div className="portal-grid">
              {data.ebooks.map((ebook) => (
                <div key={ebook.id} className="portal-card">
                  <Cover ebook={ebook} />
                  <div>
                    <strong>{ebook.title}</strong>
                    <span>{ebook.subtitle}</span>
                    <a className="btn btn-secondary btn-sm" href={ebook.downloadUrl}>
                      Download PDF ↓
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No ebooks uploaded yet" text="The library is being refreshed. Check back shortly." />
          )}
        </div>
      )}
    </div>
  );
}
