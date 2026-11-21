import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export async function api(path, { method = "GET", body, form } = {}) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (form) options.body = form;
  else if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers["content-type"] = "application/json";
  }
  const response = await fetch(path, options);
  const type = response.headers.get("content-type") || "";
  const data = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = (data && data.error) || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const CURRENCY_LOCALE = {
  INR: "en-IN",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "de-DE",
  AED: "en-AE",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
};

let currencyView = { currency: "INR", symbol: "₹", rate: 1, locale: "en-IN" };

export function setCurrencyView(next = {}) {
  currencyView = { ...currencyView, ...next };
}

export const getCurrencyView = () => currencyView;

// Store prices live in INR; this formats the buyer's converted amount.
export function formatPrice(value, config = {}) {
  const currency = String(config.currency || "INR").toUpperCase();
  const rate = currency === "INR" ? 1 : Number(config.rate) || 1;
  const amount = (Number(value) || 0) / rate;
  const decimals = currency === "INR" ? 0 : 2;
  return `${config.symbol || "₹"}${amount.toLocaleString(config.locale || CURRENCY_LOCALE[currency] || "en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export const money = (value) => formatPrice(value, currencyView);

// Admin screens always show the INR ledger, whatever the storefront currency is.
export const moneyBase = (value) => formatPrice(value, { currency: "INR", symbol: "₹", rate: 1, locale: "en-IN" });

export const currencyConfigFor = (code, pricing) => {
  const entry = (pricing?.currencies || []).find((row) => row.code === code);
  if (!entry) return { currency: "INR", symbol: "₹", rate: 1, locale: "en-IN" };
  return {
    currency: entry.code,
    symbol: entry.symbol,
    rate: entry.rate,
    locale: CURRENCY_LOCALE[entry.code] || "en-IN",
  };
};

export const prettyDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const prettyDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

/* -------------------------------- router --------------------------------- */

export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function usePath() {
  const [value, setValue] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const onChange = () => setValue(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return value;
}

export function Link({ to, children, className = "", onClick, ...rest }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (onClick) onClick(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (!to.startsWith("/")) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/* ------------------------------ site context ----------------------------- */

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [site, setSite] = useState(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [currency, setCurrencyCode] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api("/api/site");
      setSite(data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Country-aware currency: saved choice, then geo detection, then the shop's
  // default. Every price on the storefront renders through this.
  useEffect(() => {
    if (!site || !site.pricing) return;
    const list = site.pricing.currencies || [];
    if (!list.length) return;
    const stored = currency || window.localStorage.getItem("nbd:currency") || "";
    const region =
      typeof navigator !== "undefined" ? String(navigator.language || "").split("-")[1] || "" : "";
    const regionCurrency = {
      US: "USD",
      GB: "GBP",
      IN: "INR",
      AE: "AED",
      AU: "AUD",
      CA: "CAD",
      SG: "SGD",
      DE: "EUR",
      FR: "EUR",
      ES: "EUR",
      IT: "EUR",
      NL: "EUR",
    }[region.toUpperCase()];
    const chosen =
      list.find((row) => row.code === stored) ||
      list.find((row) => row.code === site.pricing.detected) ||
      list.find((row) => row.code === regionCurrency) ||
      list.find((row) => row.code === site.pricing.default) ||
      list[0];
    setCurrencyView(currencyConfigFor(chosen.code, site.pricing));
    if (chosen.code !== currency) setCurrencyCode(chosen.code);
  }, [site, currency]);

  useEffect(() => {
    if (!currency) return;
    try {
      window.localStorage.setItem("nbd:currency", currency);
    } catch {
      /* storage blocked */
    }
  }, [currency]);

  // Design-studio live preview: when the storefront runs inside the admin's
  // preview frame, the builder pushes its unsaved layout here so edits appear
  // instantly without publishing. A normal page never receives these messages.
  useEffect(() => {
    if (window.parent === window) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "nbd:studio-draft") return;
      setDraft(data.kit || null);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "nbd:studio-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const liveSite = useMemo(() => {
    if (!site || !draft) return site;
    const colors = draft.colors || {};
    return {
      ...site,
      settings: {
        ...site.settings,
        ...(colors.accent_color ? { accent_color: colors.accent_color } : {}),
        ...(colors.ink_color ? { ink_color: colors.ink_color } : {}),
        ...(colors.bg_color ? { bg_color: colors.bg_color } : {}),
      },
      blocks: Array.isArray(draft.blocks) ? draft.blocks : site.blocks,
      content: draft.content && typeof draft.content === "object" ? draft.content : site.content,
      theme: draft.theme && typeof draft.theme === "object" ? draft.theme : site.theme,
    };
  }, [site, draft]);

  const pricing = site && site.pricing ? site.pricing : null;
  const value = useMemo(
    () => ({
      site: liveSite,
      error,
      reload: load,
      pricing,
      currency,
      setCurrency: (code) => {
        const next = String(code || "").toUpperCase();
        // Update the formatter before React re-renders so prices never flash in
        // the previous currency.
        if (pricing) setCurrencyView(currencyConfigFor(next, pricing));
        setCurrencyCode(next);
      },
    }),
    [liveSite, error, load, pricing, currency]
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);

/* ------------------------- wishlist & recently viewed ---------------------- */

const readJson = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
};

const emit = (name) => window.dispatchEvent(new Event(name));

export const wishlistIds = () => readJson("nbd:wishlist", []);

export function toggleWishlist(id) {
  if (!id) return false;
  const current = wishlistIds();
  const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id].slice(-60);
  writeJson("nbd:wishlist", next);
  emit("nbd:wishlist");
  return next.includes(id);
}

export function useWishlist() {
  const [ids, setIds] = useState(() => wishlistIds());
  useEffect(() => {
    const sync = () => setIds(wishlistIds());
    window.addEventListener("nbd:wishlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nbd:wishlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}

export const recentBooks = () => readJson("nbd:recent", []);

export function trackRecent(ebook) {
  if (!ebook || !ebook.id) return;
  const entry = {
    id: ebook.id,
    slug: ebook.slug,
    title: ebook.title,
    subtitle: ebook.subtitle,
    category: ebook.category,
    pages: ebook.pages,
    price: ebook.price,
    cover: ebook.cover,
  };
  const next = [entry, ...recentBooks().filter((row) => row.id !== ebook.id)].slice(0, 8);
  writeJson("nbd:recent", next);
  emit("nbd:recent");
}

export function useRecent() {
  const [books, setBooks] = useState(() => recentBooks());
  useEffect(() => {
    const sync = () => setBooks(recentBooks());
    window.addEventListener("nbd:recent", sync);
    return () => window.removeEventListener("nbd:recent", sync);
  }, []);
  return books;
}

export function useDebounced(value, ms = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function rememberOrder(ref, email) {
  try {
    window.sessionStorage.setItem(`nbd:order:${ref}`, email);
  } catch {
    /* storage blocked */
  }
}

export function recallOrder(ref) {
  try {
    return window.sessionStorage.getItem(`nbd:order:${ref}`) || "";
  } catch {
    return "";
  }
}

export function rememberReseller(code) {
  try {
    window.localStorage.setItem("nbd:res", code);
  } catch {
    /* storage blocked */
  }
}

export function currentReseller() {
  try {
    return window.localStorage.getItem("nbd:res") || "";
  } catch {
    return "";
  }
}
