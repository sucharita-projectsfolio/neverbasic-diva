import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  api,
  money,
  navigate,
  prettyDate,
  trackRecent,
  useDebounced,
  usePath,
  useRecent,
  useSite,
  useWishlist,
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
  Stars,
  Textarea,
  useToast,
} from "../ui.jsx";
import EbookCard, { WishButton } from "./EbookCard.jsx";

/* --------------------------------- search -------------------------------- */

export function SearchPage() {
  const path = usePath();
  const { site } = useSite();
  const query = useMemo(() => new URLSearchParams(path.split("?")[1] || ""), [path]);
  const [term, setTerm] = useState(query.get("q") || "");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("relevance");
  const debounced = useDebounced(term);
  const books = site.ebooks || [];
  const categories = ["All", ...Array.from(new Set(books.map((book) => book.category).filter(Boolean)))];

  const results = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    let list = books.filter((book) => {
      if (category !== "All" && book.category !== category) return false;
      if (!needle) return true;
      return [book.title, book.subtitle, book.description, book.category, ...(book.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    if (sort === "price-low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-high") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "new") list = [...list].reverse();
    return list;
  }, [books, debounced, category, sort]);

  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">search the library</span>
          <h1>
            Find the <em>one</em> that stings a little.
          </h1>
          <p>Search by title, topic or the exact problem you want fixed.</p>
        </header>
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/search?q=${encodeURIComponent(term.trim())}`, { replace: true });
          }}
        >
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="money, boundaries, negotiation, burnout…"
            autoFocus
            aria-label="Search ebooks"
          />
          <Button type="submit">Search</Button>
        </form>
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
          <select className="input select filter-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
            <option value="relevance">Best match</option>
            <option value="new">Newest</option>
            <option value="price-low">Price: low first</option>
            <option value="price-high">Price: high first</option>
          </select>
          <span className="filter-count">{results.length} found</span>
        </div>
        {results.length ? (
          <div className="masonry">
            {results.map((ebook, index) => (
              <EbookCard key={ebook.id} ebook={ebook} index={index} />
            ))}
          </div>
        ) : (
          <Empty
            title="Nothing matched that"
            text="Try a simpler word, or ask the assistant — it knows the whole catalogue."
            action={
              <Link to="/ebooks" className="btn btn-primary">
                Back to the library
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- wishlist ------------------------------- */

export function WishlistPage() {
  const { site } = useSite();
  const ids = useWishlist();
  const books = (site.ebooks || []).filter((book) => ids.includes(book.id));
  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">saved for later</span>
          <h1>
            Your <em>shortlist.</em>
          </h1>
          <p>Saved on this device. They'll be here when you're ready.</p>
        </header>
        {books.length ? (
          <div className="masonry">
            {books.map((ebook, index) => (
              <EbookCard key={ebook.id} ebook={ebook} index={index} />
            ))}
          </div>
        ) : (
          <Empty
            title="Nothing saved yet"
            text="Tap the heart on any cover and it will wait here."
            action={
              <Link to="/ebooks" className="btn btn-primary">
                Browse the library
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

export function RecentlyViewed({ excludeId = "", compact = false }) {
  const { site } = useSite();
  const recent = useRecent().filter((book) => book.id !== excludeId);
  if (!site?.features?.recent || !recent.length) return null;
  return (
    <section className={compact ? "recent-strip compact" : "recent-strip"}>
      <div className="section-head">
        <div>
          <span className="eyebrow">where you left off</span>
          <h2>Recently <em>opened.</em></h2>
        </div>
      </div>
      <div className="recent-row">
        {recent.slice(0, 5).map((book) => (
          <Link key={book.id} to={`/ebooks/${book.slug}`} className="recent-card">
            <Cover ebook={book} />
            <div>
              <strong>{book.title}</strong>
              <small>{money(book.price)}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- journal -------------------------------- */

export function JournalPage() {
  const { site } = useSite();
  const posts = site.posts || [];
  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">the journal</span>
          <h1>
            Notes worth <em>stealing.</em>
          </h1>
          <p>Short essays in the same voice as the ebooks — money, rooms, self-respect.</p>
        </header>
        {posts.length ? (
          <div className="journal-grid wide">
            {posts.map((post, index) => (
              <Reveal key={post.id} delay={index * 50}>
                <Link to={`/journal/${post.slug}`} className="journal-card">
                  {post.cover ? <img src={post.cover} alt="" loading="lazy" /> : <span className="journal-glyph">✎</span>}
                  <div>
                    <small>{prettyDate(post.published_at)}</small>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt || String(post.body || "").slice(0, 160)}</p>
                    <span className="journal-more">Read →</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <Empty
            title="The journal is warming up"
            text="New notes publish here. The ebooks are already live."
            action={
              <Link to="/ebooks" className="btn btn-primary">
                Read the library
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

export function JournalPostPage({ slug }) {
  const { site } = useSite();
  const post = (site.posts || []).find((row) => row.slug === slug);
  if (!post) {
    return (
      <div className="page wrap">
        <Empty
          title="That note has moved"
          text="It may have been unpublished."
          action={
            <Link to="/journal" className="btn btn-primary">
              Back to the journal
            </Link>
          }
        />
      </div>
    );
  }
  const blocks = String(post.body || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="page journal-page">
      <article className="wrap narrow">
        <div className="crumbs">
          <Link to="/journal">Journal</Link> <span>/</span> <span className="muted">{post.title}</span>
        </div>
        <span className="eyebrow">{prettyDate(post.published_at)}</span>
        <h1>{post.title}</h1>
        {post.excerpt ? <p className="journal-lede">{post.excerpt}</p> : null}
        {post.cover ? <img className="journal-cover" src={post.cover} alt="" /> : null}
        <div className="journal-body">
          {blocks.map((block, index) =>
            block.startsWith("## ") ? (
              <h2 key={index}>{block.slice(3)}</h2>
            ) : block.startsWith("### ") ? (
              <h3 key={index}>{block.slice(4)}</h3>
            ) : (
              <p key={index}>{block}</p>
            )
          )}
        </div>
        <div className="journal-foot">
          <span>Want the full frameworks?</span>
          <Link to="/ebooks" className="btn btn-primary">
            Open the library →
          </Link>
        </div>
      </article>
    </div>
  );
}

/* --------------------------------- bundles -------------------------------- */

export function BundlePage({ slug }) {
  const { site } = useSite();
  const toast = useToast();
  const bundle = (site.bundles || []).find((row) => row.slug === slug);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState(null);
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

  if (!bundle) {
    return (
      <div className="page wrap">
        <Empty
          title="That bundle has closed"
          text="The individual ebooks are still available."
          action={
            <Link to="/ebooks" className="btn btn-primary">
              Back to the library
            </Link>
          }
        />
      </div>
    );
  }

  const total = coupon ? coupon.total : bundle.price;

  async function applyCode() {
    if (!code.trim()) return;
    try {
      const result = await api("/api/coupons/validate", { method: "POST", body: { code, amount: bundle.price } });
      setCoupon(result);
      toast(`${result.code} applied — ${result.label}`);
    } catch (err) {
      setCoupon(null);
      toast(err.message, "bad");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      window.localStorage.setItem("nbd:buyer", JSON.stringify(form));
      const result = await api("/api/orders", {
        method: "POST",
        body: { ...form, bundleId: bundle.id, code: coupon ? coupon.code : "" },
      });
      if (result.warning) toast(result.warning, "bad");
      startPayment(result, form.email);
      if (result.mode !== "payu" && result.mode !== "razorpay" && result.mode !== "stripe") setBusy(false);
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
            <Link to="/ebooks">← Library</Link>
          </div>
          <span className="eyebrow">{bundle.count} ebooks · one payment</span>
          <h1>{bundle.title}</h1>
          <p className="muted">{bundle.subtitle}</p>
          <ul className="bundle-items">
            {bundle.items.map((book) => (
              <li key={book.id}>
                <Cover ebook={book} />
                <div>
                  <strong>{book.title}</strong>
                  <small>{money(book.price)} alone</small>
                </div>
                <Link to={`/ebooks/${book.slug}`} className="btn btn-ghost btn-sm">
                  View
                </Link>
              </li>
            ))}
          </ul>
          <h2>
            Almost <em>yours.</em>
          </h2>
          <form onSubmit={submit} className="checkout-form">
            <Field label="Your name">
              <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" />
            </Field>
            <Field label="Email" hint="Access and order lookup are tied to this email.">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
              />
            </Field>
            <Field label="Phone / WhatsApp">
              <Input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" />
            </Field>
            <div className="coupon-row">
              <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Coupon code" aria-label="Coupon code" />
              <Button type="button" variant="secondary" onClick={applyCode}>
                Apply
              </Button>
            </div>
            {coupon ? <p className="field-hint">✓ {coupon.code} · {coupon.label}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" size="lg" loading={busy} className="btn-block">
              Pay {money(total)} securely →
            </Button>
          </form>
        </div>
        <aside className="checkout-summary">
          <span className="eyebrow">bundle summary</span>
          <div className="summary-row">
            <span>{bundle.count} ebooks</span>
            <span>{money(bundle.mrp || bundle.price)}</span>
          </div>
          {bundle.mrp > bundle.price ? (
            <div className="summary-row">
              <span>Bundle saving</span>
              <span>−{money(bundle.mrp - bundle.price)}</span>
            </div>
          ) : null}
          {coupon ? (
            <div className="summary-row">
              <span>Coupon {coupon.code}</span>
              <span>−{money(coupon.discount)}</span>
            </div>
          ) : null}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="summary-perks">
            <span>✿ Every PDF, instantly</span>
            <span>✿ One permanent order page</span>
            <span>✿ 100% refund promise</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------- newsletter ------------------------------ */

export function NewsletterInline() {
  const { site } = useSite();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");
  const [note, setNote] = useState("");
  if (!site?.features?.newsletter) return null;

  async function submit(event) {
    event.preventDefault();
    setState("busy");
    try {
      await api("/api/newsletter", { method: "POST", body: { email, source: "footer" } });
      setState("done");
      setNote("You're in. Check your inbox.");
      setEmail("");
    } catch (error) {
      setState("error");
      setNote(error.message);
    }
  }

  return (
    <div className="footer-news">
      <strong>{site.newsletter?.heading || "The quiet list"}</strong>
      <p>{site.newsletter?.note}</p>
      <form onSubmit={submit}>
        <input
          type="email"
          required
          className="input"
          placeholder="you@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="Email address"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={state === "busy"}>
          {state === "done" ? "Joined ✓" : "Join"}
        </button>
      </form>
      {note ? <small className="footer-news-note">{note}</small> : null}
    </div>
  );
}

/* ---------------------------------- sample -------------------------------- */

export function SampleModal({ ebook, open, onClose }) {
  if (!ebook) return null;
  const sample = String(ebook.sample || "").trim();
  const paragraphs = sample
    ? sample.split(/\n{2,}/)
    : [
        ebook.description || "",
        ebook.highlights?.length ? `Inside: ${ebook.highlights.slice(0, 3).join(" · ")}` : "",
        "The full ebook opens the moment your payment clears — every framework, script and number.",
      ].filter(Boolean);
  return (
    <Modal
      open={open}
      title={`Free sample · ${ebook.title}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep reading later
          </Button>
          <Link to={`/checkout/${ebook.id}`} className="btn btn-primary">
            Get the full ebook · {money(ebook.price)}
          </Link>
        </>
      }
    >
      <div className="sample-body">
        {paragraphs.map((part, index) => (
          <p key={index}>{part}</p>
        ))}
        {!sample ? <p className="field-hint">This is a preview built from the product page. The ebook itself is longer.</p> : null}
      </div>
    </Modal>
  );
}

/* ---------------------------------- share --------------------------------- */

export function ShareRow({ ebook }) {
  const { site } = useSite();
  const toast = useToast();
  if (!site?.features?.share) return null;
  const url = `${window.location.origin}/ebooks/${ebook.slug}`;
  const text = `${ebook.title} — ${ebook.subtitle || ""}`;

  async function native() {
    if (navigator.share) {
      try {
        await navigator.share({ title: ebook.title, text, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Copy failed — select the address bar", "bad");
    }
  }

  return (
    <div className="share-row">
      <span>Share</span>
      <a
        className="btn btn-ghost btn-sm"
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
      <button type="button" className="btn btn-ghost btn-sm" onClick={native}>
        Copy link
      </button>
      <WishButton ebook={ebook} className="inline" />
    </div>
  );
}

/* ------------------------------ verified review --------------------------- */

export function ReviewForm({ ebookId, orderRef, email, ebookTitle }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/reviews", {
        method: "POST",
        body: { ebookId, orderRef, email, rating, body },
      });
      setDone(true);
      toast("Review sent — thank you");
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="field-hint">✓ Review received. It appears once approved.</p>;

  return (
    <form onSubmit={submit} className="review-form">
      <div className="review-form-head">
        <strong>Review {ebookTitle || "this ebook"}</strong>
        <span className="review-stars" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? "on" : ""}
              onClick={() => setRating(value)}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
        </span>
      </div>
      <Textarea
        rows={3}
        required
        minLength={10}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="One honest sentence — what changed after you read it?"
      />
      <Button type="submit" size="sm" variant="secondary" loading={busy}>
        Send review
      </Button>
      <p className="field-hint">Only paid buyers can review. Your first name and rating are shown.</p>
    </form>
  );
}

/* -------------------------------- widgets --------------------------------- */

function Assistant() {
  const { site } = useSite();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi — I know every ebook here. Tell me what you're trying to fix and I'll point you to one." },
  ]);

  async function send(text) {
    const question = String(text ?? input).trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await api("/api/assistant", {
        method: "POST",
        body: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (error) {
      const text = String(error.message || "Something went wrong.");
      const hint = /support|whatsapp/i.test(text) ? "" : " You can also message us on WhatsApp or use the support form.";
      setMessages([...next, { role: "assistant", content: `${text}${hint}` }]);
    } finally {
      setBusy(false);
    }
  }

  function render(text) {
    const parts = String(text).split(/(\/ebooks\/[\w-]+|\/resell|\/support|\/track)/g);
    return parts.map((part, index) =>
      part.startsWith("/") ? (
        <Link key={index} to={part}>{part}</Link>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    );
  }

  return (
    <div className={`assistant${open ? " open" : ""}`}>
      {open ? (
        <div className="assistant-panel">
          <div className="assistant-head">
            <div>
              <strong>Diva assistant</strong>
              <small>answers from the catalogue</small>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </div>
          <div className="assistant-log">
            {messages.map((message, index) => (
              <div key={index} className={`assistant-msg ${message.role}`}>
                {render(message.content)}
              </div>
            ))}
            {busy ? <div className="assistant-msg assistant">Thinking…</div> : null}
          </div>
          {messages.length < 3 ? (
            <div className="assistant-suggestions">
              {["Which ebook should I start with?", "How fast do I get the PDF?", "Is the resell licence worth it?"].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything…"
              aria-label="Message the assistant"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Send
            </button>
          </form>
          <small className="assistant-fine">AI answers can be wrong. Payments and refunds follow the policies page.</small>
        </div>
      ) : null}
      <button
        type="button"
        className="assistant-bubble"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close assistant" : "Ask the assistant"}
      >
        {open ? "×" : "✷"}
      </button>
    </div>
  );
}

function SocialProof({ items }) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (!items.length) return undefined;
    let index = Math.floor(Math.random() * items.length);
    let hide;
    const show = () => {
      if (document.visibilityState === "hidden") return;
      setCurrent(items[index % items.length]);
      index += 1;
      hide = window.setTimeout(() => setCurrent(null), 6500);
    };
    const first = window.setTimeout(show, 11000);
    const timer = window.setInterval(show, 32000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(hide);
      window.clearInterval(timer);
    };
  }, [items]);
  if (!current) return null;
  return (
    <div className="social-proof" role="status">
      <span className="live-dot" />
      <div>
        <strong>{current.name} just bought {current.title}</strong>
        <small>verified order</small>
      </div>
    </div>
  );
}

function ExitOffer({ offer }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!offer || (!offer.heading && !offer.code)) return undefined;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem("nbd:exit") === "1";
    } catch {
      seen = false;
    }
    if (seen) return undefined;
    const onLeave = (event) => {
      if (event.clientY > 6) return;
      setOpen(true);
      try {
        window.sessionStorage.setItem("nbd:exit", "1");
      } catch {
        /* ignore */
      }
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [offer]);

  if (!offer) return null;
  return (
    <Modal
      open={open}
      title={offer.heading || "Before you go"}
      onClose={() => setOpen(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Link to="/ebooks" className="btn btn-primary" onClick={() => setOpen(false)}>
            Use it in the library →
          </Link>
        </>
      }
    >
      <p>{offer.note}</p>
      {offer.code ? (
        <div className="exit-code">
          <span>Your code</span>
          <strong>{offer.code}</strong>
          <CopyButton value={offer.code} label="Copy code" />
        </div>
      ) : null}
    </Modal>
  );
}

export function StoreWidgets() {
  const { site } = useSite();
  const features = site?.features || {};
  const number = site?.whatsapp?.number || "";
  return (
    <>
      {features.assistant && site.aiAvailable ? <Assistant /> : null}
      {features.whatsappFloat && number ? (
        <a
          className="wa-float"
          href={`https://wa.me/${number.replace(/[^\d]/g, "")}?text=${encodeURIComponent("Hi! I have a question about the ebooks.")}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          title={site.whatsapp?.note || "Chat on WhatsApp"}
        >
          ✆
        </a>
      ) : null}
      {features.socialProof && site.socialProof?.length ? <SocialProof items={site.socialProof} /> : null}
      {features.exitIntent && site.exitOffer ? <ExitOffer offer={site.exitOffer} /> : null}
    </>
  );
}

/* ------------------------------ product helpers ---------------------------- */

export function ProductReviews({ ebook }) {
  const { site } = useSite();
  const reviews = (site.reviews || []).filter((review) => review.ebook_id === ebook.id);
  if (!site.features?.reviews || !reviews.length) return null;
  const average = reviews.reduce((sum, review) => sum + Number(review.rating || 5), 0) / reviews.length;
  return (
    <section className="product-reviews">
      <div className="product-reviews-head">
        <h3>Verified buyer reviews</h3>
        <span>
          <Stars value={Math.round(average)} /> {average.toFixed(1)} · {reviews.length}
        </span>
      </div>
      <div className="product-review-grid">
        {reviews.slice(0, 6).map((review) => (
          <div key={review.id} className="product-review">
            <div>
              <strong>{review.name}</strong>
              <Stars value={review.rating} />
            </div>
            <p>{review.body}</p>
            <small>✓ paid order · {prettyDate(review.created_at)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function useTrackRecent(ebook) {
  useEffect(() => {
    if (ebook?.id) trackRecent(ebook);
  }, [ebook?.id]);
}
