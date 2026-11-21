// Country-aware pricing. Every price in the database is stored in Indian rupees
// (the shop's base currency); this module converts it to what the buyer's country
// should see and charges exactly that converted amount at the gateway.

export const CURRENCY_META = {
  INR: { symbol: "₹", locale: "en-IN", decimals: 0 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  GBP: { symbol: "£", locale: "en-GB", decimals: 2 },
  EUR: { symbol: "€", locale: "de-DE", decimals: 2 },
  AED: { symbol: "AED ", locale: "en-AE", decimals: 2 },
  AUD: { symbol: "A$", locale: "en-AU", decimals: 2 },
  CAD: { symbol: "C$", locale: "en-CA", decimals: 2 },
  SGD: { symbol: "S$", locale: "en-SG", decimals: 2 },
};

// 1 unit of the currency in INR. The owner can override these from
// Admin → Payments → Countries & currency without a redeploy.
export const DEFAULT_RATES = {
  INR: 1,
  USD: 84,
  GBP: 108,
  EUR: 92,
  AED: 23,
  AUD: 55,
  CAD: 61,
  SGD: 63,
};

export const COUNTRY_CURRENCY = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  AU: "AUD",
  CA: "CAD",
  SG: "SGD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  CY: "EUR",
  MT: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  HR: "EUR",
};

export const isCurrency = (code) => Object.prototype.hasOwnProperty.call(CURRENCY_META, String(code || "").toUpperCase());

export function readRates(settings = {}) {
  let overrides = {};
  try {
    const parsed = JSON.parse(settings.currency_rates || "{}");
    if (parsed && typeof parsed === "object") overrides = parsed;
  } catch {
    overrides = {};
  }
  const out = {};
  for (const code of Object.keys(CURRENCY_META)) {
    if (code === "INR") {
      out[code] = 1;
      continue;
    }
    const value = Number(overrides[code]);
    out[code] = Number.isFinite(value) && value > 0 ? value : DEFAULT_RATES[code];
  }
  return out;
}

// Round to a real, chargeable amount in the target currency.
export function convertFromInr(amountInr, currency, rates) {
  const amount = Math.max(0, Number(amountInr) || 0);
  const code = String(currency || "INR").toUpperCase();
  if (!isCurrency(code) || code === "INR") return Math.round(amount);
  if (!amount) return 0;
  const table = rates || readRates({});
  const value = amount / (table[code] || DEFAULT_RATES[code] || 1);
  return Math.max(0.5, Math.round(value * 100) / 100);
}

export function formatMoney(amount, currency, symbol) {
  const code = String(currency || "INR").toUpperCase();
  const meta = CURRENCY_META[code] || CURRENCY_META.INR;
  const value = Number(amount) || 0;
  const decimals = code === "INR" ? 0 : meta.decimals;
  const text = value.toLocaleString(meta.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${symbol || meta.symbol}${text}`;
}

export function countryOf(request, env) {
  const fromCf = request && request.cf && request.cf.country ? request.cf.country : "";
  const fromEnv = env && env.GEO_COUNTRY ? env.GEO_COUNTRY : "";
  const fromHeader =
    (request && (request.headers.get("x-country") || request.headers.get("x-nf-country"))) || "";
  return String(fromCf || fromEnv || fromHeader || "").trim().toUpperCase().slice(0, 2);
}

// The buyer's currency: an explicit request wins, then the detected country,
// then the store's base currency (INR).
export function resolveCurrency(settings = {}, requested = "", country = "") {
  const wanted = String(requested || "").toUpperCase();
  if (isCurrency(wanted)) return wanted;
  if (settings.currency_auto !== "0") {
    const detected = COUNTRY_CURRENCY[String(country || "").toUpperCase()];
    if (detected && isCurrency(detected)) return detected;
  }
  const base = String(settings.currency || "INR").toUpperCase();
  return isCurrency(base) ? base : "INR";
}

export function pricingState(settings = {}, country = "") {
  const rates = readRates(settings);
  const detected = COUNTRY_CURRENCY[String(country || "").toUpperCase()] || "";
  const currencies = Object.entries(CURRENCY_META).map(([code, meta]) => ({
    code,
    symbol: meta.symbol.trim(),
    rate: rates[code],
    decimals: meta.decimals,
  }));
  return {
    base: "INR",
    country: String(country || "").toUpperCase(),
    detected: isCurrency(detected) ? detected : "",
    auto: settings.currency_auto !== "0",
    default: resolveCurrency(settings, "", country),
    symbol: CURRENCY_META[settings.currency] ? CURRENCY_META[settings.currency].symbol.trim() : "₹",
    rates,
    currencies,
  };
}
