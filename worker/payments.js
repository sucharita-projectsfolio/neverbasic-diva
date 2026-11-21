// Payment gateways. Everything is configured from Admin → Payments: no code, no
// redeploy. PayU (hosted form), Razorpay (checkout.js), Stripe (hosted checkout)
// plus a link/UPI fallback that always works.
import { clean, money, payuRequestHash } from "./util.js";

const enc = new TextEncoder();

const b64 = (value) => btoa(value);

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(String(payload)));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

const isHttp = (value) => /^https?:\/\//i.test(String(value || "").trim());

export function gatewayState(settings = {}) {
  const payu = {
    ready: settings.payu_enabled === "1" && Boolean(settings.payu_key) && Boolean(settings.payu_salt),
    mode: settings.payu_mode === "live" ? "live" : "test",
  };
  const razorpay = {
    ready: settings.razorpay_enabled === "1" && Boolean(settings.razorpay_key_id) && Boolean(settings.razorpay_key_secret),
    keyId: settings.razorpay_key_id || "",
  };
  const stripe = {
    ready: settings.stripe_enabled === "1" && Boolean(settings.stripe_secret_key),
    publishable: settings.stripe_publishable_key || "",
  };
  const fallback = {
    link: isHttp(settings.payment_link) ? String(settings.payment_link).trim() : "",
    upi: String(settings.upi_id || "").trim(),
  };
  const choice = String(settings.payment_gateway || "auto").toLowerCase();
  const order = ["payu", "razorpay", "stripe"];
  const ready = { payu: payu.ready, razorpay: razorpay.ready, stripe: stripe.ready };
  let primary = "";
  if (choice !== "auto" && ready[choice]) primary = choice;
  if (!primary) primary = order.find((id) => ready[id]) || "";
  return {
    primary: primary || (fallback.link ? "link" : fallback.upi ? "manual" : ""),
    payu,
    razorpay,
    stripe,
    fallback,
    currency: String(settings.currency || "INR").toUpperCase(),
    symbol: settings.currency_symbol || "₹",
    public: {
      // Everything the browser is allowed to know. No secrets.
      gateway: choice,
      payu: payu.ready,
      payuMode: payu.mode,
      razorpay: razorpay.ready ? razorpay.keyId : "",
      stripe: stripe.ready ? stripe.publishable : "",
      currency: String(settings.currency || "INR").toUpperCase(),
      symbol: settings.currency_symbol || "₹",
      link: fallback.link,
      upi: fallback.upi,
      instructions: settings.pay_instructions || "",
    },
  };
}

const minor = (amount) => Math.max(1, Math.round(Number(amount || 0) * 100));

/* -------------------------------- Razorpay -------------------------------- */

async function razorpayOrder(settings, order) {
  const auth = b64(`${settings.razorpay_key_id}:${settings.razorpay_key_secret}`);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      amount: minor(order.amount),
      currency: String(settings.currency || "INR").toUpperCase(),
      receipt: order.ref,
      notes: { ref: order.ref, email: order.email, item: order.item_title },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Razorpay ${response.status}: ${detail.slice(0, 160)}`);
  }
  return response.json();
}

export async function verifyRazorpay(settings, payload = {}) {
  const secret = settings.razorpay_key_secret || "";
  if (!secret) return false;
  const expected = await hmacHex(secret, `${payload.razorpay_order_id || ""}|${payload.razorpay_payment_id || ""}`);
  return safeEqual(expected, payload.razorpay_signature || "");
}

/* --------------------------------- Stripe --------------------------------- */

async function stripeSession(settings, order, origin) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/api/stripe/return?ref=${encodeURIComponent(order.ref)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/order/${encodeURIComponent(order.ref)}?pay=failed&reason=cancelled`);
  params.set("client_reference_id", order.ref);
  params.set("customer_email", order.email);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", String(settings.currency || "INR").toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(minor(order.amount)));
  params.set("line_items[0][price_data][product_data][name]", String(order.item_title || "Ebook").slice(0, 120));
  params.set("line_items[0][price_data][product_data][description]", `Order ${order.ref}`);
  params.set("metadata[ref]", order.ref);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${settings.stripe_secret_key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Stripe ${response.status}: ${detail.slice(0, 160)}`);
  }
  return response.json();
}

export async function retrieveStripeSession(settings, sessionId) {
  if (!settings.stripe_secret_key || !sessionId) return null;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${settings.stripe_secret_key}` },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function verifyStripeSignature(settings, rawBody, header) {
  const secret = settings.stripe_webhook_secret || settings.stripe_secret_key || "";
  if (!secret || !header) return false;
  const parts = String(header).split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return acc;
    if (key === "t") acc.timestamp = value;
    if (key === "v1") acc.signatures.push(value);
    return acc;
  }, { timestamp: "", signatures: [] });
  if (!parts.timestamp) return false;
  // 5 minute replay window
  if (Math.abs(Date.now() / 1000 - Number(parts.timestamp)) > 300) return false;
  const expected = await hmacHex(secret, `${parts.timestamp}.${rawBody}`);
  return parts.signatures.some((signature) => safeEqual(expected, signature));
}

/* -------------------------------- initiation ------------------------------ */

export async function initiatePayment(env, settings, order, origin) {
  const state = gatewayState(settings);
  const base = {
    ref: order.ref,
    amount: order.amount,
    itemTitle: order.item_title,
    kind: order.kind,
    currency: state.currency,
    symbol: state.symbol,
  };

  const fallbackPayload = (warning = "") => ({
    ...base,
    mode: state.fallback.link ? "link" : "manual",
    link: state.fallback.link,
    upi: state.fallback.upi,
    instructions: settings.pay_instructions || "",
    warning:
      warning ||
      (state.fallback.link || state.fallback.upi
        ? ""
        : "No payment method is configured yet. Add a gateway key, a payment link or a UPI ID in Admin → Payments."),
  });

  if (state.primary === "payu") {
    const firstname = String(order.name || "Reader").split(" ")[0] || "Reader";
    const fields = {
      key: settings.payu_key,
      txnid: order.ref,
      amount: Number(order.amount).toFixed(2),
      productinfo: String(order.item_title || "Ebook").slice(0, 100),
      firstname,
      email: order.email,
      phone: order.phone,
      surl: `${origin}/api/payu/return`,
      furl: `${origin}/api/payu/return`,
      udf1: order.kind,
      udf2: order.email,
      udf3: "",
      udf4: "",
      udf5: "",
      service_provider: "payu_paisa",
    };
    fields.hash = await payuRequestHash({ ...fields, salt: settings.payu_salt });
    return {
      ...base,
      mode: "payu",
      action: state.payu.mode === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment",
      fields,
    };
  }

  if (state.primary === "razorpay") {
    try {
      const created = await razorpayOrder(settings, order);
      return {
        ...base,
        mode: "razorpay",
        key: settings.razorpay_key_id,
        orderId: created.id,
        name: String(settings.brand_name || "Neverbasic Diva").slice(0, 60),
        description: String(order.item_title || "Ebook").slice(0, 100),
        prefill: { name: order.name, email: order.email, contact: order.phone },
      };
    } catch (error) {
      console.error("razorpay_create_failed", error);
      return fallbackPayload(`Razorpay could not start (${String(error.message || error).slice(0, 120)}). Use the link or UPI below — your order is saved.`);
    }
  }

  if (state.primary === "stripe") {
    try {
      const session = await stripeSession(settings, order, origin);
      return { ...base, mode: "stripe", url: session.url, sessionId: session.id };
    } catch (error) {
      console.error("stripe_create_failed", error);
      return fallbackPayload(`Stripe could not start (${String(error.message || error).slice(0, 120)}). Use the link or UPI below — your order is saved.`);
    }
  }

  return fallbackPayload();
}

/* ------------------------------- admin check ------------------------------ */

export async function testGateways(settings = {}) {
  const state = gatewayState(settings);
  const out = {};

  if (settings.payu_key && settings.payu_salt) {
    out.payu = { ok: true, message: `PayU keys present — ${state.payu.mode} mode. ${money(0)} hash test runs at checkout.` };
  } else out.payu = { ok: false, message: "Add a PayU merchant key and salt." };

  if (settings.razorpay_key_id && settings.razorpay_key_secret) {
    try {
      const auth = b64(`${settings.razorpay_key_id}:${settings.razorpay_key_secret}`);
      const response = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { authorization: `Basic ${auth}` } });
      out.razorpay = response.ok
        ? { ok: true, message: "Razorpay keys verified with a live API call." }
        : { ok: false, message: `Razorpay rejected the keys (HTTP ${response.status}).` };
    } catch (error) {
      out.razorpay = { ok: false, message: `Razorpay unreachable: ${String(error.message || error).slice(0, 120)}` };
    }
  } else out.razorpay = { ok: false, message: "Add Razorpay key id and key secret." };

  if (settings.stripe_secret_key) {
    try {
      const response = await fetch("https://api.stripe.com/v1/balance", {
        headers: { authorization: `Bearer ${settings.stripe_secret_key}` },
      });
      out.stripe = response.ok
        ? { ok: true, message: `Stripe key verified (${settings.stripe_mode === "live" ? "live" : "test/standard"}).` }
        : { ok: false, message: `Stripe rejected the secret key (HTTP ${response.status}).` };
    } catch (error) {
      out.stripe = { ok: false, message: `Stripe unreachable: ${String(error.message || error).slice(0, 120)}` };
    }
  } else out.stripe = { ok: false, message: "Add a Stripe secret key." };

  const usable = [state.payu.ready && "PayU", state.razorpay.ready && "Razorpay", state.stripe.ready && "Stripe", state.fallback.link && "payment link", state.fallback.upi && "UPI"].filter(Boolean);
  return { gateways: out, active: usable, primary: state.primary || "manual" };
}

export function normaliseGatewaySettings(patch = {}) {
  const out = { ...patch };
  if (typeof out.payment_link === "string") out.payment_link = isHttp(out.payment_link) ? out.payment_link.trim().slice(0, 400) : "";
  if (typeof out.upi_id === "string") out.upi_id = clean(out.upi_id, 120);
  const allowed = ["auto", "payu", "razorpay", "stripe", "link", "manual"];
  if (out.payment_gateway && !allowed.includes(String(out.payment_gateway))) out.payment_gateway = "auto";
  if (out.currency) out.currency = String(out.currency).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "INR";
  return out;
}
