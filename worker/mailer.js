// Order delivery email. Sends the bought PDF plus a PDF receipt as attachments
// through Resend (server-side only, key never reaches the browser). If no key is
// configured the order still unlocks: the buyer downloads from the order page and
// the skip is written to the order timeline.
import * as U from "./util.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;

export function mailConfig(settings = {}, env = {}) {
  const key = String(settings.resend_api_key || env.RESEND_API_KEY || "").trim();
  const from = String(settings.mail_from || env.MAIL_FROM || "Neverbasic Diva <onboarding@resend.dev>").trim();
  return { key, from, ready: Boolean(key) };
}

export function bytesToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function sendMail(config, { to, subject, html, text = "", attachments = [] }) {
  if (!config.ready) return { ok: false, skipped: true, reason: "email_not_configured" };
  const payload = {
    from: config.from,
    to: [to],
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
  };
  if (attachments.length) payload.attachments = attachments;
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider rejected the message (${response.status}): ${detail.slice(0, 180)}`);
  }
  return { ok: true, id: (await response.json().catch(() => ({}))).id || "" };
}

export function deliveryEmailHtml({ settings, order, items, downloadUrl, receiptUrl, amountLabel, brand }) {
  const safe = (value) => String(value == null ? "" : value).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
  const list = (items || [])
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font:14px/1.5 Helvetica,Arial,sans-serif;color:#241E1B">${safe(
          item.title
        )}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee"><a href="${safe(
          item.downloadUrl
        )}" style="color:#B0665A;font:600 13px Helvetica,Arial,sans-serif;text-decoration:none">Download</a></td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#FAF6F0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #eee6da">
    <p style="font:600 11px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B0665A;margin:0 0 10px">payment confirmed</p>
    <h1 style="font:400 26px Georgia,serif;color:#241E1B;margin:0 0 8px">Your copy is ready, ${safe(
      String(order.name || "reader").split(" ")[0]
    )}.</h1>
    <p style="font:14px/1.6 Helvetica,Arial,sans-serif;color:#6f635c;margin:0 0 18px">
      Order <strong>${safe(order.ref)}</strong> · ${safe(amountLabel)} paid with ${safe(order.payment_mode || "gateway")}.
      ${items && items.length ? "Your PDF is attached to this email." : ""}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">${list}</table>
    <p style="margin:22px 0 8px">
      <a href="${safe(downloadUrl)}" style="display:inline-block;background:#B0665A;color:#fff;padding:12px 20px;border-radius:999px;font:600 13px Helvetica,Arial,sans-serif;text-decoration:none">Open my order &amp; download</a>
    </p>
    <p style="font:12px/1.6 Helvetica,Arial,sans-serif;color:#8b7f77;margin:14px 0 0">
      Receipt: <a href="${safe(receiptUrl)}" style="color:#B0665A">download PDF receipt</a> · Keep this email — the download link stays live for good.
    </p>
    <p style="font:12px/1.6 Helvetica,Arial,sans-serif;color:#a89d95;margin:22px 0 0;border-top:1px solid #eee6da;padding-top:14px">
      ${safe(brand)} · ${safe(settings.support_email || "")} · This is a digital product purchase receipt.
    </p>
  </div></body></html>`;
}

export function receiptPdf({ settings, order, meta, amountLabel, brand }) {
  return U.demoPdf(
    order.item_title || "Order receipt",
    `${brand} · payment receipt · ${order.ref}`,
    [
      `Receipt number: ${order.ref}`,
      `Buyer: ${order.name} · ${order.email}`,
      `Item: ${order.item_title}`,
      `Amount paid: ${amountLabel}`,
      `Currency: ${order.currency || "INR"}`,
      `Payment method: ${order.payment_mode || "gateway"}${order.payu_txnid ? ` · ${order.payu_txnid}` : ""}`,
      `Paid on: ${order.paid_at || new Date().toISOString()}`,
      meta && meta.discount ? `Discount: ${meta.coupon?.code || ""} (-${meta.discount} INR base)` : "",
      "This receipt confirms a paid digital product purchase. The download link never expires.",
      `${brand} · ${settings.support_email || ""}`,
    ].filter(Boolean)
  );
}

export { MAX_ATTACHMENT_BYTES };
