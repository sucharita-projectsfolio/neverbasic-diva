import React from "react";
import { Link, money, useSite } from "../lib/api.jsx";
import { Cover, Reveal, Stars, Faq, Button, Chip } from "../ui.jsx";
import EbookCard from "./EbookCard.jsx";

function splitTitle(title = "") {
  const words = String(title).trim().split(/\s+/);
  if (words.length <= 3) return { head: "", tail: title };
  const cut = Math.max(2, words.length - 3);
  return { head: words.slice(0, cut).join(" "), tail: words.slice(cut).join(" ") };
}

export default function Home() {
  const { site } = useSite();
  const settings = site.settings;
  const ebooks = site.ebooks || [];
  const featured = ebooks.filter((book) => book.featured).length ? ebooks.filter((book) => book.featured) : ebooks;
  const hero = splitTitle(settings.hero_title);
  const insta = settings.instagram || "neverbasic_diva";
  const stats = Array.isArray(settings.stats) ? settings.stats : [];
  const faqs = Array.isArray(settings.faqs) ? settings.faqs : [];
  const testimonials = site.testimonials || [];
  const lowest = ebooks.length ? Math.min(...ebooks.map((book) => Number(book.price) || 0)) : 99;

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-copy">
          <Reveal>
            <span className="eyebrow">
              <span className="eyebrow-dot" /> {settings.hero_eyebrow}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="hero-title">
              {hero.head ? <>{hero.head} </> : null}
              <em>{hero.tail}</em>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="hero-sub">{settings.hero_sub}</p>
          </Reveal>
          <Reveal delay={220}>
            <div className="hero-actions">
              <Link to="/ebooks" className="btn btn-primary btn-lg">
                Open the library <span aria-hidden="true">→</span>
              </Link>
              <Link to="/resell" className="btn btn-ghost btn-lg">
                Resell &amp; earn
              </Link>
            </div>
          </Reveal>
          <Reveal delay={280}>
            <p className="hero-note">
              <span className="hero-note-mark">✿</span> {settings.hero_note}
            </p>
          </Reveal>
        </div>
        <Reveal delay={140} className="hero-art">
          <div className="art-stack">
            {featured.slice(0, 3).map((book, index) => (
              <Link
                key={book.id}
                to={`/ebooks/${book.slug}`}
                className={`art-card art-card-${index + 1}`}
                aria-label={book.title}
              >
                <Cover ebook={book} lazy={false} />
              </Link>
            ))}
            <div className="art-sticker">
              <span className="art-sticker-top">from</span>
              <strong>{money(lowest)}</strong>
              <span className="art-sticker-bottom">ek chai se sasta</span>
            </div>
            <div className="art-note">
              <span>no fluff</span>
              <span>just the unspoken part</span>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="stats-strip">
        <div className="wrap stats-grid">
          {stats.map((stat, index) => (
            <Reveal key={index} delay={index * 60} className="stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section library" id="library">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">the library</span>
              <h2>
                Small books. <em>Unfair</em> advantage.
              </h2>
            </div>
            <Link to="/ebooks" className="link-underline">
              See all {ebooks.length} ebooks →
            </Link>
          </div>
          {ebooks.length ? (
            <div className="masonry">
              {featured.map((ebook, index) => (
                <EbookCard key={ebook.id} ebook={ebook} index={index} />
              ))}
            </div>
          ) : (
            <p className="muted">The first ebooks are being uploaded. Check back in a moment.</p>
          )}
        </div>
      </section>

      <section className="section value">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">why this hits different</span>
            <h2>
              Not another <em>motivational</em> PDF.
            </h2>
            <p className="section-sub">
              Every page is built to be used the same day. Frameworks, scripts and numbers — not vibes.
            </p>
          </div>
          <div className="value-grid">
            {[
              {
                mark: "01",
                title: "One sitting, not one month",
                text: "Written tight. You can read any ebook on a commute and still have something to apply tonight.",
              },
              {
                mark: "02",
                title: "The part nobody says out loud",
                text: "The exact lines to use, the numbers to ask for, the dynamics people pretend don't exist.",
              },
              {
                mark: "03",
                title: "Priced to travel",
                text: "Less than a coffee, because the point is that you actually buy it instead of saving it for later.",
              },
              {
                mark: "04",
                title: "Yours, tracked, guaranteed",
                text: "Instant access after payment, a permanent order page, and a real 100% refund promise.",
              },
            ].map((item, index) => (
              <Reveal key={item.mark} delay={index * 70} className="value-card">
                <span className="value-mark">{item.mark}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section quote-band">
        <div className="wrap">
          <Reveal className="quote-inner">
            <span className="eyebrow light">a reader, last week</span>
            <blockquote>
              “I read Soft Power on a Tuesday and used one line in a meeting on Wednesday. My manager
              asked where I learned to talk like that.”
            </blockquote>
            <span className="quote-by">— @thegirlwhonegotiated</span>
          </Reveal>
        </div>
      </section>

      <section className="section notes">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">notes from readers</span>
              <h2>
                Quietly <em>changing</em> things.
              </h2>
            </div>
            <a className="link-underline" href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer">
              More on @{insta} →
            </a>
          </div>
          <div className="notes-grid">
            {testimonials.map((item, index) => (
              <Reveal key={item.id} delay={index * 60} className="note-card">
                <Stars value={item.rating} />
                <p>{item.body}</p>
                <div className="note-by">
                  <span className="note-avatar">{String(item.name || "R").charAt(0)}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.handle}</small>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {settings.resell_enabled === "1" ? (
        <section className="section resell-band">
          <div className="wrap resell-inner">
            <Reveal className="resell-copy">
              <span className="eyebrow light">resell rights · one year</span>
              <h2>
                Sell these words. <em>Keep the money.</em>
              </h2>
              <p>
                A one-time ₹{settings.resell_price || 399} licence lets you resell every Neverbasic Diva
                ebook for a full year. Post it on your stories, your page, your reels — you keep 100% of
                what you charge. No monthly cuts, no permission calls.
              </p>
              <ul className="resell-list">
                <li>All ebooks, sellable for 1 full year</li>
                <li>Your own reseller code + tracking link</li>
                <li>Keep 100% of your selling price</li>
                <li>Renew only if you want another year</li>
              </ul>
              <div className="resell-actions">
                <Link to="/resell" className="btn btn-cream">
                  Get resell rights — ₹{settings.resell_price || 399}
                </Link>
                <Link to="/resell/portal" className="btn btn-outline-light">
                  Reseller login
                </Link>
              </div>
            </Reveal>
            <Reveal delay={120} className="resell-price-card">
              <span className="price-badge">one-time</span>
              <div className="price-big">₹{settings.resell_price || 399}</div>
              <span className="price-sub">1 year · unlimited reselling</span>
              <div className="price-divider" />
              <p>{settings.resell_commission_note}</p>
              <span className="price-fine">Licence activates the moment your payment is verified.</span>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="section promise">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">the promise</span>
            <h2>
              If it doesn't land, <em>we fix it.</em>
            </h2>
            <p className="section-sub">{settings.refund_policy}</p>
          </div>
          <div className="steps">
            {[
              {
                step: "Step one",
                title: "Tell us what you actually wanted",
                text: "Use the support form or the refund page. One honest paragraph is enough.",
              },
              {
                step: "Step two",
                title: "We send material matched to it",
                text: "A different ebook, a focused note, or a custom guide built around your exact question.",
              },
              {
                step: "Step three",
                title: "Still not it? 100% back",
                text: "No debate, no store credit. If nothing lands, your money comes back.",
              },
            ].map((item, index) => (
              <Reveal key={item.step} delay={index * 90} className="step-card">
                <span className="step-num">{index + 1}</span>
                <span className="step-eyebrow">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </Reveal>
            ))}
          </div>
          <div className="promise-actions">
            <Link to="/support" className="btn btn-ghost">
              Ask for help
            </Link>
            <Link to="/refund" className="btn btn-ghost">
              Refund request
            </Link>
          </div>
        </div>
      </section>

      <section className="section faq-section">
        <div className="wrap faq-wrap">
          <div className="faq-intro">
            <span className="eyebrow">before you ask</span>
            <h2>
              Honest <em>answers.</em>
            </h2>
            <p>Still unsure? The support form goes straight to a human, not a bot.</p>
            <Link to="/support" className="link-underline">
              Open support →
            </Link>
          </div>
          <Faq items={faqs} />
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap final-inner">
          <Chip>instant delivery</Chip>
          <h2>
            One chai. <em>One shift.</em>
          </h2>
          <p>Pick the ebook that makes you slightly uncomfortable. That's usually the one.</p>
          <div className="hero-actions">
            <Link to="/ebooks" className="btn btn-primary btn-lg">
              Browse the library
            </Link>
            <a
              className="btn btn-ghost btn-lg"
              href={`https://instagram.com/${insta}`}
              target="_blank"
              rel="noreferrer"
            >
              @{insta}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
