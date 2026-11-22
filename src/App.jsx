import React, { useEffect, useMemo, useRef, useState } from "react";
import { SiteProvider, useSite, usePath, Link, api, currentReseller, useWishlist } from "./lib/api.jsx";
import { ToastHost } from "./ui.jsx";
import { readKit, fillTokens } from "./lib/sitekit.js";
import { applySeo, seoForPath } from "./lib/seo.js";
import Home from "./pages/Home.jsx";
import { Shop, EbookPage, Checkout, OrderPage, TrackPage } from "./pages/Store.jsx";
import { SupportPage, RequestPage, RefundPage, PoliciesPage, ResellPage, PortalPage } from "./pages/Support.jsx";
import {
  BundlePage,
  JournalPage,
  JournalPostPage,
  NewsletterInline,
  SearchPage,
  StoreWidgets,
  WishlistPage,
} from "./pages/Extras.jsx";
import Admin from "./admin/Admin.jsx";
import AccountPage from "./pages/Account.jsx";

function setMeta(name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function OfferClock({ endsAt, label }) {
  const [left, setLeft] = useState(() => new Date(endsAt).getTime() - Date.now());
  useEffect(() => {
    const tick = () => setLeft(new Date(endsAt).getTime() - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt || Number.isNaN(new Date(endsAt).getTime()) || left <= 0) return null;
  const days = Math.floor(left / 864e5);
  const hours = Math.floor((left % 864e5) / 36e5);
  const minutes = Math.floor((left % 36e5) / 6e4);
  const seconds = Math.floor((left % 6e4) / 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return (
    <span className="offer-clock">
      <span className="offer-clock-label">{label}</span>
      <strong>
        {days ? `${days}d ` : ""}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </strong>
    </span>
  );
}

function Nav() {
  const { site, pricing, currency, setCurrency } = useSite();
  const path = usePath();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const settings = site?.settings || {};
  const features = site?.features || {};
  const wishlist = useWishlist();
  const { content, theme } = useMemo(() => readKit(site), [site]);
  const brand = settings.brand_name || "Neverbasic Diva";
  const tokens = { brand, insta: settings.instagram || "neverbasic_diva", price: Number(settings.resell_price) || 399 };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [path]);

  const links = [
    ["/ebooks", fillTokens(content.nav_library, tokens)],
    ["/resell", fillTokens(content.nav_resell, tokens)],
    ["/support", fillTokens(content.nav_support, tokens)],
    ["/track", fillTokens(content.nav_order, tokens)],
  ];

  return (
    <>
      {settings.announcement && theme.showAnnouncement ? (
        <div className={`marquee speed-${theme.announcementSpeed || "normal"}`} aria-hidden="true">
          <div className="marquee-track">
            <span>{settings.announcement}</span>
            {features.countdown !== false ? <OfferClock endsAt={theme.offerEndsAt} label={content.offer_label} /> : null}
            <span>{settings.announcement}</span>
            <span>{settings.announcement}</span>
          </div>
        </div>
      ) : null}
      <header className={`nav ${scrolled ? "is-solid" : ""}`}>
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label={brand}>
            <span className="brand-mark" aria-hidden="true">
              ✿
            </span>
            <span className="brand-word">
              {brand.toLowerCase().split(" ").map((word, index) => (
                <span key={index} className={index === 0 ? "brand-thin" : "brand-bold"}>
                  {word}
                  {index === 0 ? " " : ""}
                </span>
              ))}
            </span>
          </Link>
          <nav className={`nav-links ${open ? "open" : ""}`}>
            {links.map(([to, label]) => (
              <Link key={to} to={to} className={path === to ? "active" : ""}>
                {label}
              </Link>
            ))}
            {features.journal ? <Link to="/journal" className={path === "/journal" ? "active" : ""}>Journal</Link> : null}
            {features.search ? (
              <Link to="/search" className="nav-icon" aria-label="Search the library">
                ⌕
              </Link>
            ) : null}
            {features.wishlist ? (
              <Link to="/wishlist" className="nav-icon nav-wish" aria-label="Wishlist">
                ♡{wishlist.length ? <span className="nav-wish-count">{wishlist.length}</span> : null}
              </Link>
            ) : null}
            <Link to="/account" className={`nav-icon${path === "/account" ? " active" : ""}`} aria-label="Your account">
              ◍
            </Link>
            {pricing?.currencies?.length > 1 ? (
              <select
                className="nav-currency"
                value={currency || "INR"}
                onChange={(event) => setCurrency(event.target.value)}
                aria-label="Show prices in"
              >
                {pricing.currencies.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code}
                  </option>
                ))}
              </select>
            ) : null}
            <Link to="/ebooks" className="btn btn-primary btn-sm nav-cta">
              {fillTokens(content.nav_cta, tokens)}
            </Link>
          </nav>
          <button
            type="button"
            className={`burger ${open ? "open" : ""}`}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <span />
            <span />
          </button>
        </div>
      </header>
    </>
  );
}

function Footer() {
  const { site } = useSite();
  const settings = site?.settings || {};
  const { content } = useMemo(() => readKit(site), [site]);
  const insta = settings.instagram || "neverbasic_diva";
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="brand brand-footer">
            <span className="brand-mark" aria-hidden="true">
              ✿
            </span>
            <span className="brand-word">{(settings.brand_name || "Neverbasic Diva").toLowerCase()}</span>
          </div>
          <p>{settings.brand_tagline}</p>
          <a className="insta-link" href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer">
            <span aria-hidden="true">◎</span> @{insta}
          </a>
        </div>
        <div className="footer-col">
          <h5>{content.footer_explore}</h5>
          <Link to="/ebooks">{content.nav_library}</Link>
          <Link to="/resell">{content.nav_resell}</Link>
          <Link to="/request">{content.footer_link_request}</Link>
          <Link to="/track">{content.footer_link_track}</Link>
          <Link to="/account">Your account</Link>
        </div>
        <div className="footer-col">
          <h5>{content.footer_care}</h5>
          <Link to="/support">{content.footer_link_support}</Link>
          <Link to="/refund">{content.footer_link_refund}</Link>
          <Link to="/policies">{content.footer_link_policies}</Link>
          <a href={`mailto:${settings.support_email || ""}`}>{content.footer_link_email}</a>
        </div>
        <div className="footer-col">
          <h5>{content.footer_payments}</h5>
          <p className="footer-note">{content.footer_note_1}</p>
          <p className="footer-note">{content.footer_note_2}</p>
          <Link to="/admin" className="footer-admin">
            {content.footer_admin}
          </Link>
        </div>
      </div>
      <NewsletterInline />
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {settings.brand_name || "Neverbasic Diva"}. {content.footer_rights}
        </span>
        <span className="footer-fine">{content.footer_fine}</span>
      </div>
    </footer>
  );
}

function Routes() {
  const path = usePath();
  const { pathname } = useMemo(() => new URL(path, window.location.origin), [path]);
  const clean = pathname.replace(/\/+$/, "") || "/";

  if (clean === "/") return <Home />;
  if (clean === "/ebooks") return <Shop />;
  if (clean.startsWith("/ebooks/")) return <EbookPage slug={clean.slice("/ebooks/".length)} />;
  if (clean.startsWith("/checkout/")) return <Checkout ebookId={clean.slice("/checkout/".length)} />;
  if (clean.startsWith("/order/")) return <OrderPage reference={clean.slice("/order/".length)} />;
  if (clean === "/track") return <TrackPage />;
  if (clean === "/account") return <AccountPage />;
  if (clean === "/search") return <SearchPage />;
  if (clean === "/wishlist") return <WishlistPage />;
  if (clean === "/journal") return <JournalPage />;
  if (clean.startsWith("/journal/")) return <JournalPostPage slug={clean.slice("/journal/".length)} />;
  if (clean.startsWith("/bundle/")) return <BundlePage slug={clean.slice("/bundle/".length)} />;
  if (clean === "/support") return <SupportPage />;
  if (clean === "/request") return <RequestPage />;
  if (clean === "/refund") return <RefundPage />;
  if (clean === "/policies") return <PoliciesPage />;
  if (clean === "/resell") return <ResellPage />;
  if (clean === "/resell/portal") return <PortalPage />;
  if (clean === "/admin") return <Admin />;
  return <Home />;
}

// Slow colour fields plus a cursor-following light. Both are decorative, sit
// behind the page and switch themselves off for touch and reduced-motion users.
function Ambience() {
  const glow = useRef(null);
  const progress = useRef(null);

  useEffect(() => {
    const bar = progress.current;
    let ticking = false;
    const paint = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (bar) bar.style.transform = `scaleX(${ratio})`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const node = glow.current;
    if (!node || window.matchMedia("(hover: none)").matches) return undefined;
    let frame = 0;
    const move = (event) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        node.style.setProperty("--cursor-x", `${event.clientX}px`);
        node.style.setProperty("--cursor-y", `${event.clientY}px`);
        frame = 0;
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="site-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="cursor-glow" ref={glow} aria-hidden="true" />
      <div className="scroll-progress" ref={progress} aria-hidden="true" />
    </>
  );
}

function Shell() {
  const path = usePath();
  const { site, error } = useSite();
  const settings = site?.settings || {};
  const { theme, shape, font } = useMemo(() => readKit(site), [site]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.accent_color) root.style.setProperty("--accent", settings.accent_color);
    if (settings.ink_color) root.style.setProperty("--ink", settings.ink_color);
    if (settings.bg_color) root.style.setProperty("--bg", settings.bg_color);
    root.dataset.shape = shape.id;
    root.dataset.density = theme.density || "cozy";
    root.style.setProperty("--r-sm", `${shape.sm}px`);
    root.style.setProperty("--r-md", `${shape.md}px`);
    root.style.setProperty("--r-lg", `${shape.lg}px`);
    root.style.setProperty("--font-display", font.display);
    root.style.setProperty("--font-body", font.body);
    // Per-route title, description, canonical and JSON-LD (see src/lib/seo.js).
    applySeo({
      ...seoForPath(path, site, { title: theme.seoTitle, description: theme.seoDescription }),
      image: theme.ogImage || undefined,
    });
    setMeta("theme-color", settings.accent_color);
  }, [settings.accent_color, settings.ink_color, settings.bg_color, settings.brand_name, settings.brand_tagline, theme, shape, font, path, site]);

  useEffect(() => {
    const { pathname } = new URL(path, window.location.origin);
    if (pathname.startsWith("/admin")) return;
    if (window.parent !== window) return; // admin live-preview frame — not a real visit
    api("/api/track", { method: "POST", body: { path: pathname, res: currentReseller() } }).catch(() => {});
  }, [path]);

  if (error) {
    return (
      <div className="boot-error">
        <h1>Store could not load</h1>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="boot">
        <div className="boot-mark">✿</div>
        <p>Opening the library…</p>
      </div>
    );
  }

  const isAdmin = path.startsWith("/admin");
  return (
    <div className="app">
      {theme.customCss ? <style>{theme.customCss}</style> : null}
      {isAdmin ? (
        <Routes />
      ) : (
        <>
          <Ambience />
          <Nav />
          <main key={path.replace(/\?.*$/, "")} className="route-stage">
            <Routes />
          </main>
          <Footer />
          <StoreWidgets />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SiteProvider>
      <ToastHost>
        <Shell />
      </ToastHost>
    </SiteProvider>
  );
}
