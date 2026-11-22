// Meta pixel + first-touch attribution for the storefront.
//
// The pixel is loaded only when Admin → Growth → Meta ads is on and a numeric
// pixel id is saved. Nothing here runs for admin pages (the caller decides).

let startedId = "";

export function initMetaPixel(pixelId) {
  if (typeof window === "undefined") return false;
  const id = String(pixelId || "").trim();
  if (!/^\d{6,20}$/.test(id)) return false;
  if (startedId === id) return true;
  startedId = id;

  if (!window.fbq) {
    const fbq = function (...args) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  window.fbq("init", id);
  window.fbq("track", "PageView");
  return true;
}

export function trackMeta(event, params = {}, eventId = "") {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    if (eventId) window.fbq("track", event, params, { eventID: eventId });
    else window.fbq("track", event, params);
  } catch {
    /* tracking must never break the page */
  }
}

const readCookies = () => {
  const out = {};
  for (const part of String(document.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) out[key] = decodeURIComponent(rest.join("="));
  }
  return out;
};

const ATTR_KEY = "nbd:attr";
const ATTR_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

// First-touch campaign data. Later visits keep the original source unless the
// visitor arrives with a new campaign link.
export function captureAttribution() {
  if (typeof window === "undefined") return {};
  let stored = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(ATTR_KEY) || "{}") || {};
  } catch {
    stored = {};
  }
  const next = { ...stored };
  try {
    const params = new URLSearchParams(window.location.search);
    for (const field of ATTR_FIELDS) {
      const value = params.get(field);
      if (value) next[field] = value.slice(0, 160);
    }
  } catch {
    /* ignore malformed urls */
  }
  if (!next.landing) next.landing = window.location.pathname;
  if (!next.at) next.at = new Date().toISOString();
  const cookies = readCookies();
  if (cookies._fbp) next.fbp = cookies._fbp;
  if (cookies._fbc) next.fbc = cookies._fbc;
  try {
    window.localStorage.setItem(ATTR_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function readAttribution() {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(ATTR_KEY) || "{}");
    const cookies = readCookies();
    return {
      ...(stored && typeof stored === "object" ? stored : {}),
      fbp: cookies._fbp || stored.fbp || "",
      fbc: cookies._fbc || stored.fbc || "",
    };
  } catch {
    return {};
  }
}
