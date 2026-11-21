import React, { useEffect, useMemo, useState } from "react";
import { SiteProvider, useSite, usePath, Link, api, currentReseller } from "./lib/api.jsx";
import { ToastHost } from "./ui.jsx";
import Home from "./pages/Home.jsx";
import { Shop, EbookPage, Checkout, OrderPage, TrackPage } from "./pages/Store.jsx";
import { SupportPage, RequestPage, RefundPage, PoliciesPage, ResellPage, PortalPage } from "./pages/Support.jsx";
import Admin from "./admin/Admin.jsx";

function Nav() {
  const { site } = useSite();
  const path = usePath();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const settings = site?.settings || {};
  const brand = settings.brand_name || "Neverbasic Diva";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [path]);

  const links = [
    ["/ebooks", "Library"],
    ["/resell", "Resell rights"],
    ["/support", "Support"],
    ["/track", "My order"],
  ];

  return (
    <>
      {settings.announcement ? (
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            <span>{settings.announcement}</span>
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
              Shop the library
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
  const insta = settings.instagram || "neverbasic_diva";
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="brand brand-footer">
            <span className="brand-mark" aria-hidden="true">
              ✿
            </span>
            <span className="brand-word">
              {(settings.brand_name || "Neverbasic Diva").toLowerCase()}
            </span>
          </div>
          <p>{settings.brand_tagline}</p>
          <a className="insta-link" href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer">
            <span aria-hidden="true">◎</span> @{insta}
          </a>
        </div>
        <div className="footer-col">
          <h5>Explore</h5>
          <Link to="/ebooks">The library</Link>
          <Link to="/resell">Resell rights</Link>
          <Link to="/request">Request an ebook</Link>
          <Link to="/track">Find my order</Link>
        </div>
        <div className="footer-col">
          <h5>Care</h5>
          <Link to="/support">Help &amp; support</Link>
          <Link to="/refund">Refund promise</Link>
          <Link to="/policies">Licence &amp; privacy</Link>
          <a href={`mailto:${settings.support_email || ""}`}>Email us</a>
        </div>
        <div className="footer-col">
          <h5>Payments</h5>
          <p className="footer-note">Secure checkout via PayU · UPI · cards</p>
          <p className="footer-note">Instant PDF delivery after payment</p>
          <Link to="/admin" className="footer-admin">
            Admin
          </Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {settings.brand_name || "Neverbasic Diva"}. All rights reserved.</span>
        <span className="footer-fine">Every ebook is original work. Reselling without a licence is not permitted.</span>
      </div>
    </footer>
  );
}

function Routes() {
  const path = usePath();
  const { pathname } = useMemo(() => new URL(path, window.location.origin), [path]);
  const clean = pathname.replace(/\/+$/, "") || "/";

  if (clean === "/" ) return <Home />;
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

  useEffect(() => {
    const root = document.documentElement;
    if (settings.accent_color) root.style.setProperty("--accent", settings.accent_color);
    if (settings.ink_color) root.style.setProperty("--ink", settings.ink_color);
    if (settings.bg_color) root.style.setProperty("--bg", settings.bg_color);
    document.title = `${settings.brand_name || "Neverbasic Diva"} — ${settings.brand_tagline || "micro-ebooks"}`;
  }, [settings.accent_color, settings.ink_color, settings.bg_color, settings.brand_name, settings.brand_tagline]);

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
