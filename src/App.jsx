import React, { useEffect, useMemo, useState } from "react";
import { SiteProvider, useSite, usePath, Link, api, currentReseller } from "./lib/api.jsx";
import { ToastHost } from "./ui.jsx";
import { readKit, fillTokens } from "./lib/sitekit.js";
import Home from "./pages/Home.jsx";
import { Shop, EbookPage, Checkout, OrderPage, TrackPage } from "./pages/Store.jsx";
import { SupportPage, RequestPage, RefundPage, PoliciesPage, ResellPage, PortalPage } from "./pages/Support.jsx";
import Admin from "./admin/Admin.jsx";

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
  const { site } = useSite();
  const path = usePath();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const settings = site?.settings || {};
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
            <OfferClock endsAt={theme.offerEndsAt} label={content.offer_label} />
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
  if (clean === "/support") return <SupportPage />;
  if (clean === "/request") return <RequestPage />;
  if (clean === "/refund") return <RefundPage />;
  if (clean === "/policies") return <PoliciesPage />;
  if (clean === "/resell") return <ResellPage />;
  if (clean === "/resell/portal") return <PortalPage />;
  if (clean === "/admin") return <Admin />;
  return <Home />;
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
    document.title =
      theme.seoTitle || `${settings.brand_name || "Neverbasic Diva"} — ${settings.brand_tagline || "micro-ebooks"}`;
    setMeta("description", theme.seoDescription || settings.brand_tagline);
    setMeta("theme-color", settings.accent_color);
    if (theme.ogImage) {
      let og = document.querySelector('meta[property="og:image"]');
      if (!og) {
        og = document.createElement("meta");
        og.setAttribute("property", "og:image");
        document.head.appendChild(og);
      }
      og.setAttribute("content", theme.ogImage);
    }
  }, [settings.accent_color, settings.ink_color, settings.bg_color, settings.brand_name, settings.brand_tagline, theme, shape, font]);

  useEffect(() => {
    const { pathname } = new URL(path, window.location.origin);
    if (pathname.startsWith("/admin")) return;
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
          <Nav />
          <main>
            <Routes />
          </main>
          <Footer />
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
