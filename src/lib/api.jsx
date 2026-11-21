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

export const money = (value) => "₹" + Number(value || 0).toLocaleString("en-IN");

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

  return (
    <SiteContext.Provider value={{ site: liveSite, error, reload: load }}>{children}</SiteContext.Provider>
  );
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
