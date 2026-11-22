// Meta (Facebook/Instagram) Conversions API.
//
// The browser pixel sends a Purchase with event_id "purchase-<ref>". This module
// sends the same event server-to-server with the same id, so Meta deduplicates
// them: one purchase, better matching, and ad blockers or iOS cannot hide it.
// A missing token or a Meta outage is logged and never blocks delivery.

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || "").trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const json = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

function normalisePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits.slice(0, 15);
}

export async function sendMetaPurchase(env, settings, order) {
  if (!order || order.status !== "paid") return { skipped: "not_paid" };
  if (String(settings.meta_pixel_enabled || "0") !== "1") return { skipped: "disabled" };
  const pixelId = String(settings.meta_pixel_id || "").trim();
  const token = String(settings.meta_capi_token || "").trim();
  if (!/^\d{6,20}$/.test(pixelId) || !token) return { skipped: "not_configured" };
  if (order.meta_capi_at) return { skipped: "already_sent" };

  const db = env.DB;
  const meta = json(order.meta, {});
  const origin = String(meta.origin || settings.site_url || "").replace(/\/$/, "");
  if (!origin) return { skipped: "no_site_url" };

  const ids = Array.isArray(meta.ebookIds) && meta.ebookIds.length ? meta.ebookIds : order.ebook_id ? [order.ebook_id] : [];
  const email = String(order.email || "").trim().toLowerCase();
  const phone = normalisePhone(order.phone);
  const attribution = meta.attribution && typeof meta.attribution === "object" ? meta.attribution : {};
  const user = {
    external_id: [await sha256(email)],
  };
  if (email) user.em = [await sha256(email)];
  if (phone) user.ph = [await sha256(phone)];
  if (attribution.fbp) user.fbp = String(attribution.fbp).slice(0, 120);
  if (attribution.fbc) user.fbc = String(attribution.fbc).slice(0, 200);

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `purchase-${order.ref}`,
        action_source: "website",
        event_source_url: `${origin}/order/${encodeURIComponent(order.ref)}`,
        user_data: user,
        custom_data: {
          currency: String(order.currency || "INR").toUpperCase(),
          value: Number(order.amount_charged) || Number(order.amount) || 0,
          content_type: "product",
          content_ids: ids,
          num_items: ids.length || 1,
          order_id: order.ref,
        },
      },
    ],
  };
  if (settings.meta_test_code) payload.test_event_code = String(settings.meta_test_code).slice(0, 40);

  const endpoint = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`meta_capi_${response.status}: ${String(body?.error?.message || "").slice(0, 200)}`);
  }
  try {
    await db
      .prepare("UPDATE orders SET meta_capi_at = ? WHERE ref = ?")
      .bind(new Date().toISOString(), order.ref)
      .run();
  } catch {
    // Older databases without the column still get the event; only dedup is lost.
  }
  return { ok: true, events_received: body?.events_received ?? 1 };
}
