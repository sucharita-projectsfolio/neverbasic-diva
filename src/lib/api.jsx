import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

  return (
    <SiteContext.Provider value={{ site, error, reload: load }}>{children}</SiteContext.Provider>
  );
}

export const useSite = () => useContext(SiteContext);

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
