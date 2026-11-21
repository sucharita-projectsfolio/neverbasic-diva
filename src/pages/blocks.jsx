import React from "react";
import { Link, money, useSite } from "../lib/api.jsx";
import { Cover, Reveal, Stars, Faq, Chip } from "../ui.jsx";
import { fillTokens } from "../lib/sitekit.js";
import EbookCard from "./EbookCard.jsx";

/* --------------------------------- text ---------------------------------- */

// Supports *italic* and **bold** inside any builder label.
export function Rich({ text, tokens }) {
  const value = fillTokens(String(text ?? ""), tokens);
  const parts = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
}

const paragraphs = (value) => String(value || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

function Head({ eyebrow, title, sub, center = false, tokens }) {
  if (!eyebrow && !title && !sub) return null;
  return (
    <div className={center ? "section-head center" : "section-head"}>
      <div>
        {eyebrow ? (
          <span className="eyebrow">
            <Rich text={eyebrow} tokens={tokens} />
          </span>
        ) : null}
        {title ? (
          <h2>
            <Rich text={title} tokens={tokens} />
          </h2>
        ) : null}
        {sub && !center ? <p className="section-sub">{<Rich text={sub} tokens={tokens} />}</p> : null}
      </div>
      {center && sub ? <p className="section-sub">{<Rich text={sub} tokens={tokens} />}</p> : null}
    </div>
  );
}

/* --------------------------------- hero ---------------------------------- */

function HeroArt({ block, list, lowest, tokens }) {
  if (block.art === "none" || !list.length) return null;
  const covers = block.art === "single" ? list.slice(0, 1) : list.slice(0, 3);
  return (
    <div className={`art-stack art-${block.art || "stack"}`}>
      {covers.map((book, index) => (
        <Link key={book.id} to={`/ebooks/${book.slug}`} className={`art-card art-card-${index + 1}`} aria-label={book.title}>
          <Cover ebook={book} lazy={false} />
        </Link>
      ))}
      {block.stickerNote || block.stickerTop ? (
        <div className="art-sticker">
          <span className="art-sticker-top">{block.stickerTop}</span>
          <strong>{money(lowest)}</strong>
          <span className="art-sticker-bottom">{block.stickerNote}</span>
        </div>
      ) : null}
      {block.artNote1 || block.artNote2 ? (
        <div className="art-note">
          <span>{block.artNote1}</span>
          <span>{block.artNote2}</span>
        </div>
      ) : null}
    </div>
  );
}

function Hero({ block, site, tokens }) {
  const ebooks = site.ebooks || [];
  const featured = ebooks.filter((book) => book.featured).length ? ebooks.filter((book) => book.featured) : ebooks;
  const lowest = ebooks.length ? Math.min(...ebooks.map((book) => Number(book.price) || 0)) : 99;
  const layout = block.layout || "split";
  const height = block.height === "tall" ? " hero-tall" : block.height === "compact" ? " hero-compact" : "";

  const copy = (
    <div className="hero-copy">
      {block.eyebrow ? (
        <Reveal>
          <span className="eyebrow">
            <span className="eyebrow-dot" /> <Rich text={block.eyebrow} tokens={tokens} />
          </span>
        </Reveal>
      ) : null}
      {block.title ? (
        <Reveal delay={80}>
          <h1 className="hero-title">
            <Rich text={block.title} tokens={tokens} />
          </h1>
        </Reveal>
      ) : null}
      {block.sub ? (
        <Reveal delay={160}>
          <p className="hero-sub">
            <Rich text={block.sub} tokens={tokens} />
          </p>
        </Reveal>
      ) : null}
      {block.primaryLabel || block.secondaryLabel ? (
        <Reveal delay={220}>
          <div className="hero-actions">
            {block.primaryLabel ? (
              <Link to={block.primaryLink || "/ebooks"} className="btn btn-primary btn-lg">
                {block.primaryLabel} <span aria-hidden="true">→</span>
              </Link>
            ) : null}
            {block.secondaryLabel ? (
              <Link to={block.secondaryLink || "/resell"} className="btn btn-ghost btn-lg">
                {block.secondaryLabel}
              </Link>
            ) : null}
          </div>
        </Reveal>
      ) : null}
      {block.note ? (
        <Reveal delay={280}>
          <p className="hero-note">
            <span className="hero-note-mark">✿</span> <Rich text={block.note} tokens={tokens} />
          </p>
        </Reveal>
      ) : null}
    </div>
  );

  if (layout === "banner") {
    return (
      <section
        className={`hero hero-banner${height}${block.image ? " has-image" : ""}`}
        style={block.image ? { backgroundImage: `url(${block.image})` } : undefined}
      >
        <div className="hero-banner-shade" aria-hidden="true" />
        <div className="hero-banner-inner">
          {copy}
          {block.art !== "none" ? (
            <Reveal delay={140} className="hero-art">
              <HeroArt block={block} list={featured} lowest={lowest} tokens={tokens} />
            </Reveal>
          ) : null}
        </div>
      </section>
    );
  }

  if (layout === "centered") {
    return (
      <section className={`hero hero-centered${height}`}>
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-centered-inner">{copy}</div>
        {block.art !== "none" ? (
          <Reveal delay={140} className="hero-art hero-art-centered">
            <HeroArt block={block} list={featured} lowest={lowest} tokens={tokens} />
          </Reveal>
        ) : null}
      </section>
    );
  }

  if (layout === "minimal") {
    return (
      <section className={`hero hero-minimal${height}`}>
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-minimal-inner">{copy}</div>
      </section>
    );
  }

  return (
    <section className={`hero${height}`}>
      <div className="hero-grain" aria-hidden="true" />
      {copy}
      {block.art !== "none" ? (
        <Reveal delay={140} className="hero-art">
          <HeroArt block={block} list={featured} lowest={lowest} tokens={tokens} />
        </Reveal>
      ) : null}
    </section>
  );
}

/* ------------------------------- sections -------------------------------- */

function Stats({ block, tokens }) {
  const items = Array.isArray(block.items) ? block.items.filter((item) => item && (item.value || item.label)) : [];
  if (!items.length) return null;
  return (
    <section className={`stats-strip stats-${block.style || "plain"}`}>
      <div className="wrap">
        {block.eyebrow ? (
          <span className="eyebrow stats-eyebrow">
            <Rich text={block.eyebrow} tokens={tokens} />
          </span>
        ) : null}
        <div className="stats-grid">
          {items.map((stat, index) => (
            <Reveal key={index} delay={index * 60} className="stat">
              <strong>{fillTokens(stat.value, tokens)}</strong>
              <span>{fillTokens(stat.label, tokens)}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Library({ block, site, tokens }) {
  const ebooks = site.ebooks || [];
  const featured = block.onlyFeatured && ebooks.some((book) => book.featured) ? ebooks.filter((book) => book.featured) : ebooks;
  const list = block.limit > 0 ? featured.slice(0, Number(block.limit)) : featured;
  return (
    <section className="section library" id="library">
      <div className="wrap">
        <div className="section-head">
          <div>
            {block.eyebrow ? (
              <span className="eyebrow">
                <Rich text={block.eyebrow} tokens={tokens} />
              </span>
            ) : null}
            {block.title ? (
              <h2>
                <Rich text={block.title} tokens={tokens} />
              </h2>
            ) : null}
            {block.sub ? <p className="section-sub">{<Rich text={block.sub} tokens={tokens} />}</p> : null}
          </div>
          {block.ctaLabel ? (
            <Link to={block.ctaLink || "/ebooks"} className="link-underline">
              {block.ctaLabel} {ebooks.length ? `(${ebooks.length})` : ""} →
            </Link>
          ) : null}
        </div>
        {list.length ? (
          <div className={`masonry masonry-${block.layout || "masonry"}`}>
            {list.map((ebook, index) => (
              <EbookCard key={ebook.id} ebook={ebook} index={index} />
            ))}
          </div>
        ) : (
          <p className="muted">The first ebooks are being uploaded. Check back in a moment.</p>
        )}
      </div>
    </section>
  );
}

function Value({ block, tokens }) {
  const items = Array.isArray(block.items) ? block.items : [];
  return (
    <section className="section value">
      <div className="wrap">
        <Head eyebrow={block.eyebrow} title={block.title} sub={block.sub} center tokens={tokens} />
        <div className={`value-grid value-${block.shape || "card"}`}>
          {items.map((item, index) => (
            <Reveal key={index} delay={index * 70} className="value-card">
              {item.mark ? <span className="value-mark">{fillTokens(item.mark, tokens)}</span> : null}
              {item.title ? <h3>{fillTokens(item.title, tokens)}</h3> : null}
              {item.text ? <p>{fillTokens(item.text, tokens)}</p> : null}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Quote({ block, tokens }) {
  return (
    <section
      className={`section quote-band${block.image ? " has-image" : ""}`}
      style={block.image ? { backgroundImage: `url(${block.image})` } : undefined}
    >
      <div className="wrap">
        <Reveal className="quote-inner">
          {block.eyebrow ? (
            <span className="eyebrow light">
              <Rich text={block.eyebrow} tokens={tokens} />
            </span>
          ) : null}
          {block.text ? <blockquote>“{fillTokens(block.text, tokens)}”</blockquote> : null}
          {block.by ? <span className="quote-by">{fillTokens(block.by, tokens)}</span> : null}
        </Reveal>
      </div>
    </section>
  );
}

function Testimonials({ block, site, tokens }) {
  const settings = site.settings || {};
  const insta = settings.instagram || "neverbasic_diva";
  const items = site.testimonials || [];
  return (
    <section className="section notes">
      <div className="wrap">
        <div className="section-head">
          <div>
            {block.eyebrow ? (
              <span className="eyebrow">
                <Rich text={block.eyebrow} tokens={tokens} />
              </span>
            ) : null}
            {block.title ? (
              <h2>
                <Rich text={block.title} tokens={tokens} />
              </h2>
            ) : null}
            {block.sub ? <p className="section-sub">{<Rich text={block.sub} tokens={tokens} />}</p> : null}
          </div>
          {block.ctaLabel ? (
            <a className="link-underline" href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer">
              {fillTokens(block.ctaLabel, tokens)} →
            </a>
          ) : null}
        </div>
        <div className="notes-grid">
          {items.map((item, index) => (
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
          {!items.length ? <p className="muted">Reviews will appear here as they come in.</p> : null}
        </div>
      </div>
    </section>
  );
}

function Resell({ block, site, tokens }) {
  const price = money(tokens.price);
  return (
    <section className="section resell-band">
      <div className="wrap resell-inner">
        <Reveal className="resell-copy">
          {block.eyebrow ? (
            <span className="eyebrow light">
              <Rich text={block.eyebrow} tokens={tokens} />
            </span>
          ) : null}
          {block.title ? (
            <h2>
              <Rich text={block.title} tokens={tokens} />
            </h2>
          ) : null}
          {block.text ? <p>{fillTokens(block.text, tokens)}</p> : null}
          {Array.isArray(block.items) && block.items.length ? (
            <ul className="resell-list">
              {block.items.map((item, index) => (
                <li key={index}>{fillTokens(item, tokens)}</li>
              ))}
            </ul>
          ) : null}
          <div className="resell-actions">
            <Link to="/resell" className="btn btn-cream">
              {fillTokens(block.primaryLabel || "Get resell rights", tokens)} — {price}
            </Link>
            <Link to="/resell/portal" className="btn btn-outline-light">
              {block.secondaryLabel || "Reseller login"}
            </Link>
          </div>
        </Reveal>
        <Reveal delay={120} className="resell-price-card">
          <span className="price-badge">{block.badge || "one-time"}</span>
          <div className="price-big">{price}</div>
          <span className="price-sub">1 year · unlimited reselling</span>
          <div className="price-divider" />
          {block.priceNote ? <p>{fillTokens(block.priceNote, tokens)}</p> : null}
          {block.fine ? <span className="price-fine">{fillTokens(block.fine, tokens)}</span> : null}
        </Reveal>
      </div>
    </section>
  );
}

function Promise({ block, tokens }) {
  const steps = Array.isArray(block.steps) ? block.steps : [];
  return (
    <section className="section promise">
      <div className="wrap">
        <Head eyebrow={block.eyebrow} title={block.title} sub={block.sub} center tokens={tokens} />
        <div className="steps">
          {steps.map((item, index) => (
            <Reveal key={index} delay={index * 90} className="step-card">
              <span className="step-num">{index + 1}</span>
              {item.step ? <span className="step-eyebrow">{fillTokens(item.step, tokens)}</span> : null}
              {item.title ? <h3>{fillTokens(item.title, tokens)}</h3> : null}
              {item.text ? <p>{fillTokens(item.text, tokens)}</p> : null}
            </Reveal>
          ))}
        </div>
        <div className="promise-actions">
          <Link to="/support" className="btn btn-ghost">
            {block.primaryLabel || "Ask for help"}
          </Link>
          <Link to="/refund" className="btn btn-ghost">
            {block.secondaryLabel || "Refund request"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function FaqBlock({ block, site, tokens }) {
  const faqs = Array.isArray(site.settings?.faqs) ? site.settings.faqs : [];
  return (
    <section className="section faq-section">
      <div className="wrap faq-wrap">
        <div className="faq-intro">
          {block.eyebrow ? (
            <span className="eyebrow">
              <Rich text={block.eyebrow} tokens={tokens} />
            </span>
          ) : null}
          {block.title ? (
            <h2>
              <Rich text={block.title} tokens={tokens} />
            </h2>
          ) : null}
          {block.sub ? <p>{fillTokens(block.sub, tokens)}</p> : null}
          {block.ctaLabel ? (
            <Link to="/support" className="link-underline">
              {block.ctaLabel}
            </Link>
          ) : null}
        </div>
        <Faq items={faqs} />
      </div>
    </section>
  );
}

function Cta({ block, site, tokens }) {
  const insta = site.settings?.instagram || "neverbasic_diva";
  const secondary = block.secondaryLink || `https://instagram.com/${insta}`;
  return (
    <section
      className={`final-cta${block.image ? " has-image" : ""}`}
      style={block.image ? { backgroundImage: `url(${block.image})` } : undefined}
    >
      <div className="wrap final-inner">
        {block.badge ? <Chip>{fillTokens(block.badge, tokens)}</Chip> : null}
        {block.title ? (
          <h2>
            <Rich text={block.title} tokens={tokens} />
          </h2>
        ) : null}
        {block.sub ? <p>{fillTokens(block.sub, tokens)}</p> : null}
        <div className="hero-actions">
          {block.primaryLabel ? (
            <Link to={block.primaryLink || "/ebooks"} className="btn btn-primary btn-lg">
              {block.primaryLabel}
            </Link>
          ) : null}
          {block.secondaryLabel ? (
            <a className="btn btn-ghost btn-lg" href={secondary} target="_blank" rel="noreferrer">
              {fillTokens(block.secondaryLabel, tokens)}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Banner({ block, tokens }) {
  return (
    <section
      className={`block-banner banner-${block.align || "left"} banner-${block.overlay || "soft"} banner-${block.height || "normal"}${block.image ? " has-image" : ""}`}
      style={block.image ? { backgroundImage: `url(${block.image})` } : undefined}
    >
      <div className="block-banner-inner">
        {block.eyebrow ? (
          <span className="eyebrow">
            <Rich text={block.eyebrow} tokens={tokens} />
          </span>
        ) : null}
        {block.title ? (
          <h2>
            <Rich text={block.title} tokens={tokens} />
          </h2>
        ) : null}
        {block.sub ? <p>{fillTokens(block.sub, tokens)}</p> : null}
        {block.ctaLabel ? (
          <Link to={block.ctaLink || "/ebooks"} className="btn btn-primary btn-lg">
            {block.ctaLabel} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function TextBlock({ block, tokens }) {
  return (
    <section className={`section block-text text-${block.align || "left"} text-${block.width || "normal"}`}>
      <div className="wrap">
        {block.eyebrow ? (
          <span className="eyebrow">
            <Rich text={block.eyebrow} tokens={tokens} />
          </span>
        ) : null}
        {block.title ? (
          <h2>
            <Rich text={block.title} tokens={tokens} />
          </h2>
        ) : null}
        <div className="block-text-body">
          {paragraphs(fillTokens(block.body, tokens)).map((part, index) => (
            <p key={index}>
              <Rich text={part} tokens={tokens} />
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery({ block, site, tokens }) {
  const ebooks = site.ebooks || [];
  const list = block.limit > 0 ? ebooks.slice(0, Number(block.limit)) : ebooks;
  const columns = Math.min(6, Math.max(2, Number(block.columns) || 4));
  return (
    <section className="section block-gallery">
      <div className="wrap">
        <Head eyebrow={block.eyebrow} title={block.title} sub={block.sub} tokens={tokens} />
        <div className="block-gallery-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {list.map((ebook, index) => (
            <Reveal key={ebook.id} delay={Math.min(index, 6) * 50}>
              <Link to={`/ebooks/${ebook.slug}`} className="gallery-tile" aria-label={ebook.title}>
                <Cover ebook={ebook} />
                <span className="gallery-title">{ebook.title}</span>
                <span className="gallery-price">{money(ebook.price)}</span>
              </Link>
            </Reveal>
          ))}
        </div>
        {block.ctaLabel ? (
          <div className="gallery-actions">
            <Link to="/ebooks" className="btn btn-ghost">
              {block.ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------- dispatcher ------------------------------- */

const RENDERERS = {
  hero: Hero,
  stats: Stats,
  library: Library,
  value: Value,
  quote: Quote,
  testimonials: Testimonials,
  resell: Resell,
  promise: Promise,
  faq: FaqBlock,
  cta: Cta,
  banner: Banner,
  text: TextBlock,
  gallery: Gallery,
};

export function Block({ block, site, tokens }) {
  const Renderer = RENDERERS[block.type];
  if (!Renderer) return null;
  if (block.type === "resell" && site.settings?.resell_enabled === "0") return null;
  return <Renderer block={block} site={site} tokens={tokens} />;
}

export function BlockList({ blocks, site, tokens }) {
  return (
    <>
      {(blocks || [])
        .filter((block) => block && !block.hidden)
        .map((block) => (
          <Block key={block.id} block={block} site={site} tokens={tokens} />
        ))}
    </>
  );
}
