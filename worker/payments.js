// Payment gateways. Everything is configured from Admin → Payments: no code, no
// redeploy. PayPal (hosted, verified capture), PayU (hosted form), Razorpay
// (checkout.js), Stripe (hosted checkout) plus a link/UPI fallback that always
// works. Amounts are converted from the store's INR base to the buyer's
// currency before they leave the server, so what is shown is what is charged.
import { money, payuRequestHash } from "./util.js";
import { convertFromInr, readRates, formatMoney } from "./currency.js";

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
  const paypal = {
    ready:
      settings.paypal_enabled === "1" &&
      Boolean(settings.paypal_client_id) &&
      Boolean(settings.paypal_client_secret),
    mode: settings.paypal_mode === "live" ? "live" : "sandbox",
  };
  const fallback = {
    link: isHttp(settings.payment_link) ? String(settings.payment_link).trim() : "",
    upi: String(settings.upi_id || "").trim(),
  };
  const choice = String(settings.payment_gateway || "auto").toLowerCase();
  const order = ["paypal", "stripe", "payu", "razorpay"];
  const ready = { paypal: paypal.ready, stripe: stripe.ready, payu: payu.ready, razorpay: razorpay.ready };
  let primary = "";
  if (choice !== "auto" && ready[choice]) primary = choice;
  if (!primary) primary = order.find((id) => ready[id]) || "";
  return {
    primary: primary || (fallback.link ? "link" : fallback.upi ? "manual" : ""),
    payu,
    razorpay,
    stripe,
    paypal,
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
      paypal: paypal.ready,
      paypalMode: paypal.mode,
      currency: String(settings.currency || "INR").toUpperCase(),
      symbol: settings.currency_symbol || "₹",
      link: fallback.link,
      upi: fallback.upi,
      instructions: settings.pay_instructions || "",
    },
  };
}

// Which buttons a buyer should see for this currency. PayPal only handles
// non-INR money; PayU/Razorpay/UPI only handle INR.
export function paymentMethods(settings = {}, currency = "INR") {
  const state = gatewayState(settings);
  const code = String(currency || "INR").toUpperCase();
  const methods = [];
  if (code !== "INR" && state.paypal.ready) {
    methods.push({ id: "paypal", label: "PayPal", note: "PayPal balance, cards, wallets — no account required" });
  }
  if (code !== "INR" && state.stripe.ready) {
    methods.push({ id: "stripe", label: "Card", note: "Visa, Mastercard, Amex via Stripe" });
  }
  if (code === "INR" && state.payu.ready) {
    methods.push({ id: "payu", label: "PayU", note: "UPI, cards, netbanking, wallets" });
  }
  if (code === "INR" && state.razorpay.ready) {
    methods.push({ id: "razorpay", label: "Razorpay", note: "UPI, cards, netbanking, wallets" });
  }
  if (code === "INR" && state.fallback.upi && !methods.length) {
    methods.push({ id: "upi", label: "UPI transfer", note: "Pay the exact amount to our UPI ID" });
  }
  if (state.fallback.link) {
    methods.push({ id: "link", label: "Payment link", note: "Opens the secure payment page" });
  }
  return methods;
}

const minor = (amount) => Math.max(1, Math.round(Number(amount || 0) * 100));

/* -------------------------------- Razorpay -------------------------------- */

async function razorpayOrder(settings, order) {
  const auth = b64(`${settings.razorpay_key_id}:${settings.razorpay_key_secret}`);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      amount: minor(order.amount_charged),
      currency: String(order.currency || "INR").toUpperCase(),
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
  params.set("line_items[0][price_data][currency]", String(order.currency || settings.currency || "USD").toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(minor(order.amount_charged)));
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

/* --------------------------------- PayPal --------------------------------- */

const paypalBase = (settings) =>
  settings.paypal_mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function paypalToken(settings) {
  if (!settings.paypal_client_id || !settings.paypal_client_secret) throw new Error("PayPal keys are missing.");
  const response = await fetch(`${paypalBase(settings)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${b64(`${settings.paypal_client_id}:${settings.paypal_client_secret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`PayPal auth ${response.status}: ${detail.slice(0, 140)}`);
  }
  const data = await response.json();
  if (!data.access_token) throw new Error("PayPal did not return an access token.");
  return data.access_token;
}

async function paypalOrder(settings, order, origin) {
  const token = await paypalToken(settings);
  const currency = String(order.currency || "USD").toUpperCase();
  const value = Number(order.amount_charged).toFixed(2);
  const response = await fetch(`${paypalBase(settings)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "paypal-request-id": `nbd-${order.ref}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.ref,
          custom_id: order.ref,
          description: String(order.item_title || "Ebook").slice(0, 120),
          amount: { currency_code: currency, value },
        },
      ],
      application_context: {
        brand_name: String(settings.brand_name || settings.brand_tagline || "Neverbasic Diva").slice(0, 120),
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${origin}/api/paypal/return?ref=${encodeURIComponent(order.ref)}`,
        cancel_url: `${origin}/order/${encodeURIComponent(order.ref)}?pay=failed&reason=cancelled`,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`PayPal order ${response.status}: ${detail.slice(0, 160)}`);
  }
  const data = await response.json();
  const approve = (data.links || []).find((link) => link.rel === "approve" || link.rel === "payer-action");
  if (!approve || !approve.href) throw new Error("PayPal did not return an approval link.");
  return { id: data.id, approveUrl: approve.href };
}

export async function capturePaypalOrder(settings, paypalOrderId) {
  const token = await paypalToken(settings);
  const response = await fetch(
    `${paypalBase(settings)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "paypal-request-id": `nbd-capture-${paypalOrderId}`,
      },
      body: "{}",
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data && data.details ? JSON.stringify(data.details).slice(0, 160) : "";
    throw new Error(`PayPal capture ${response.status}: ${data.message || detail}`);
  }
  return data;
}

export function paypalCaptureResult(payload = {}) {
  const unit = (payload.purchase_units || [])[0] || {};
  const capture = (unit.payments && unit.payments.captures && unit.payments.captures[0]) || {};
  return {
    status: payload.status || "",
    captureId: capture.id || "",
    captureStatus: capture.status || "",
    amount: Number(capture.amount && capture.amount.value ? capture.amount.value : 0),
    currency: String((capture.amount && capture.amount.currency_code) || unit.amount?.currency_code || "").toUpperCase(),
    reference: String(unit.reference_id || unit.custom_id || ""),
  };
}

export async function verifyPaypalWebhook(settings, headers, rawBody) {
  if (!settings.paypal_webhook_id) return false;
  const token = await paypalToken(settings);
  const response = await fetch(`${paypalBase(settings)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo") || "",
      cert_url: headers.get("paypal-cert-url") || "",
      transmission_id: headers.get("paypal-transmission-id") || "",
      transmission_sig: headers.get("paypal-transmission-sig") || "",
      transmission_time: headers.get("paypal-transmission-time") || "",
      webhook_id: settings.paypal_webhook_id,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => ({}));
  return data.verification_status === "SUCCESS";
}

/* -------------------------------- initiation ------------------------------ */

export async function initiatePayment(env, settings, order, origin, requestedMethod = "") {
  const state = gatewayState(settings);
  const currency = String(order.currency || "INR").toUpperCase();
  const amountCharged = Number(order.amount_charged) || Number(order.amount) || 0;
  const base = {
    ref: order.ref,
    amount: Number(order.amount) || 0,
    amountCharged,
    charged: amountCharged,
    itemTitle: order.item_title,
    kind: order.kind,
    currency,
    currencySymbol: formatMoney(0, currency).replace(/[\d.,\s]/g, "") || state.symbol,
    methods: paymentMethods(settings, currency),
  };
  const chosen = String(requestedMethod || "").toLowerCase();
  const allowed = base.methods.map((method) => method.id);
  const method = allowed.includes(chosen)
    ? chosen
    : currency === "INR"
      ? allowed.find((id) => id === "payu" || id === "razorpay" || id === "upi") || allowed[0] || ""
      : allowed.find((id) => id === "paypal" || id === "stripe") || allowed[0] || "";

  const fallbackPayload = (warning = "", mode = "") => ({
    ...base,
    mode: mode || (state.fallback.link ? "link" : "manual"),
    method: state.fallback.link ? "link" : "manual",
    link: state.fallback.link,
    upi: state.fallback.upi,
    instructions: settings.pay_instructions || "",
    warning:
      warning ||
      (state.fallback.link || state.fallback.upi
        ? ""
        : "No payment method is configured yet. Add PayPal (or PayU) keys in Admin → Payments."),
  });

  if (method === "paypal") {
    try {
      const created = await paypalOrder(settings, { ...order, currency, amount_charged: amountCharged }, origin);
      return {
        ...base,
        mode: "paypal",
        method: "paypal",
        url: created.approveUrl,
        gatewayOrderId: created.id,
      };
    } catch (error) {
      console.error("paypal_create_failed", error);
      return fallbackPayload(`PayPal could not start (${String(error.message || error).slice(0, 120)}). Try another method — your order is saved.`);
    }
  }

  if (method === "payu") {
    const firstname = String(order.name || "Reader").split(" ")[0] || "Reader";
    const fields = {
      key: settings.payu_key,
      txnid: order.ref,
      amount: Number(amountCharged).toFixed(2),
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
      method: "payu",
      action: state.payu.mode === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment",
      fields,
    };
  }

  if (method === "razorpay") {
    try {
      const created = await razorpayOrder(settings, { ...order, currency, amount_charged: amountCharged });
      return {
        ...base,
        mode: "razorpay",
        method: "razorpay",
        key: settings.razorpay_key_id,
        orderId: created.id,
        gatewayOrderId: created.id,
        name: String(settings.brand_name || "Neverbasic Diva").slice(0, 60),
        description: String(order.item_title || "Ebook").slice(0, 100),
        prefill: { name: order.name, email: order.email, contact: order.phone },
      };
    } catch (error) {
      console.error("razorpay_create_failed", error);
      return fallbackPayload(`Razorpay could not start (${String(error.message || error).slice(0, 120)}). Use the link or UPI below — your order is saved.`);
    }
  }

  if (method === "stripe") {
    try {
      const session = await stripeSession(settings, { ...order, currency, amount_charged: amountCharged }, origin);
      return { ...base, mode: "stripe", method: "stripe", url: session.url, sessionId: session.id, gatewayOrderId: session.id };
    } catch (error) {
      console.error("stripe_create_failed", error);
      return fallbackPayload(`Stripe could not start (${String(error.message || error).slice(0, 120)}). Use the link below — your order is saved.`);
    }
  }

  return fallbackPayload();
}

/* ------------------------------- admin check ------------------------------ */

export async function testGateways(settings = {}) {
  const state = gatewayState(settings);
  const out = {};

  if (settings.payu_key && settings.payu_salt) {
    out.payu = { ok: true, message: `PayU keys present — ${state.payu.mode} mode. INR only.` };
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

  if (settings.paypal_client_id && settings.paypal_client_secret) {
    try {
      const token = await paypalToken(settings);
      out.paypal = token
        ? { ok: true, message: `PayPal keys verified — ${state.paypal.mode} mode. USD/GBP/EUR etc.` }
        : { ok: false, message: "PayPal did not return a token." };
    } catch (error) {
      out.paypal = { ok: false, message: `PayPal: ${String(error.message || error).slice(0, 140)}` };
    }
  } else out.paypal = { ok: false, message: "Add a PayPal client id and secret." };

  const usable = [
    state.paypal.ready && "PayPal",
    state.stripe.ready && "Stripe",
    state.payu.ready && "PayU",
    state.razorpay.ready && "Razorpay",
    state.fallback.link && "payment link",
    state.fallback.upi && "UPI",
  ].filter(Boolean);
  return { gateways: out, active: usable, primary: state.primary || "manual" };
}

export function normaliseGatewaySettings(patch = {}) {
  const out = { ...patch };
  if (typeof out.payment_link === "string") out.payment_link = isHttp(out.payment_link) ? out.payment_link.trim().slice(0, 400) : "";
  if (typeof out.upi_id === "string") out.upi_id = String(out.upi_id).trim().slice(0, 120);
  const allowed = ["auto", "paypal", "payu", "razorpay", "stripe", "link", "manual"];
  if (out.payment_gateway && !allowed.includes(String(out.payment_gateway))) out.payment_gateway = "auto";
  if (out.currency) out.currency = String(out.currency).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "INR";
  if (out.paypal_mode && !["live", "sandbox"].includes(String(out.paypal_mode))) out.paypal_mode = "sandbox";
  if (typeof out.currency_rates === "string") {
    try {
      const parsed = JSON.parse(out.currency_rates || "{}");
      const rates = {};
      for (const [code, value] of Object.entries(parsed && typeof parsed === "object" ? parsed : {})) {
        const key = String(code).toUpperCase().slice(0, 3);
        const rate = Number(value);
        if (key === "INR") continue;
        if (Number.isFinite(rate) && rate > 0) rates[key] = Math.round(rate * 10000) / 10000;
      }
      rates.INR = 1;
      out.currency_rates = JSON.stringify(rates);
    } catch {
      out.currency_rates = JSON.stringify({ INR: 1 });
    }
  }
  return out;
}

export { money, convertFromInr, readRates, formatMoney };
