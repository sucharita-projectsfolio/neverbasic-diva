import React, { useMemo, useState } from "react";
import { api, money, prettyDate, prettyDateTime } from "../lib/api.jsx";
import { FEATURE_LABELS } from "../lib/sitekit.js";
import { Button, Field, Input, Modal, Select, StatusPill, Textarea, Toggle, useToast } from "../ui.jsx";

const parse = (value, fallback) => {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
};

function Card({ title, hint, children, actions }) {
  return (
    <section className="admin-card">
      {(title || actions) && (
        <div className="admin-card-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {hint ? <p>{hint}</p> : null}
          </div>
          {actions ? <div className="admin-card-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

const TABS = [
  ["features", "Features"],
  ["coupons", "Coupons"],
  ["bundles", "Bundles"],
  ["journal", "Journal"],
  ["newsletter", "Subscribers"],
  ["reviews", "Verified reviews"],
];

export default function Growth({ data, reload }) {
  const [tab, setTab] = useState("features");
  return (
    <div className="stack-lg">
      <div className="studio-tabs slim">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "features" ? <Features data={data} reload={reload} /> : null}
      {tab === "coupons" ? <Coupons data={data} reload={reload} /> : null}
      {tab === "bundles" ? <Bundles data={data} reload={reload} /> : null}
      {tab === "journal" ? <Journal data={data} reload={reload} /> : null}
      {tab === "newsletter" ? <Subscribers data={data} reload={reload} /> : null}
      {tab === "reviews" ? <ReviewsQueue data={data} reload={reload} /> : null}
    </div>
  );
}

/* -------------------------------- features -------------------------------- */

function Features({ data, reload }) {
  const toast = useToast();
  const settings = data.settings || {};
  const [features, setFeatures] = useState(() => {
    const base = Object.fromEntries(FEATURE_LABELS.map(([key]) => [key, true]));
    return { ...base, ...parse(settings.store_features, {}) };
  });
  const [copy, setCopy] = useState({
    exit_offer_heading: settings.exit_offer_heading || "",
    exit_offer_note: settings.exit_offer_note || "",
    exit_coupon_code: settings.exit_coupon_code || "",
    newsletter_heading: settings.newsletter_heading || "",
    newsletter_note: settings.newsletter_note || "",
    whatsapp_note: settings.whatsapp_note || "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "POST",
        body: { store_features: JSON.stringify(features), ...copy },
      });
      toast("Storefront features saved");
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setSaving(false);
    }
  }

  const enabled = FEATURE_LABELS.filter(([key]) => features[key] !== false).length;

  return (
    <div className="stack-lg">
      <Card
        title={`${enabled} of ${FEATURE_LABELS.length} storefront features on`}
        hint="Every switch is instant. Turn anything off and the store simply stops showing it — nothing breaks."
        actions={
          <Button size="sm" onClick={save} loading={saving}>
            Save features
          </Button>
        }
      >
        <div className="feature-toggle-grid">
          {FEATURE_LABELS.map(([key, label, hint]) => (
            <div key={key} className={`feature-toggle${features[key] !== false ? " on" : ""}`}>
              <Toggle
                checked={features[key] !== false}
                onChange={(value) => setFeatures({ ...features, [key]: value })}
                label={label}
                hint={hint}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Conversion copy" hint="The words around the exit offer, newsletter and WhatsApp button.">
        <div className="two-col">
          <Field label="Exit offer heading">
            <Input value={copy.exit_offer_heading} onChange={(event) => setCopy({ ...copy, exit_offer_heading: event.target.value })} />
          </Field>
          <Field label="Exit offer coupon code" hint="Create the coupon first, then paste its code here.">
            <Input value={copy.exit_coupon_code} onChange={(event) => setCopy({ ...copy, exit_coupon_code: event.target.value.toUpperCase() })} />
          </Field>
        </div>
        <Field label="Exit offer note">
          <Textarea rows={2} value={copy.exit_offer_note} onChange={(event) => setCopy({ ...copy, exit_offer_note: event.target.value })} />
        </Field>
        <div className="two-col">
          <Field label="Newsletter heading">
            <Input value={copy.newsletter_heading} onChange={(event) => setCopy({ ...copy, newsletter_heading: event.target.value })} />
          </Field>
          <Field label="Newsletter note">
            <Input value={copy.newsletter_note} onChange={(event) => setCopy({ ...copy, newsletter_note: event.target.value })} />
          </Field>
        </div>
        <Field label="WhatsApp note" hint="Tooltip on the floating button. The number itself is in Site content.">
          <Input value={copy.whatsapp_note} onChange={(event) => setCopy({ ...copy, whatsapp_note: event.target.value })} />
        </Field>
        <Button variant="secondary" onClick={save} loading={saving}>
          Save copy
        </Button>
      </Card>
    </div>
  );
}

/* --------------------------------- coupons -------------------------------- */

function Coupons({ data, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    code: "",
    kind: "percent",
    value: 10,
    min_amount: 0,
    max_uses: 0,
    expires_at: "",
    status: "active",
  });

  function open(row) {
    setForm(
      row
        ? { ...row, expires_at: row.expires_at ? String(row.expires_at).slice(0, 16) : "" }
        : { id: "", code: "", kind: "percent", value: 10, min_amount: 0, max_uses: 0, expires_at: "", status: "active" }
    );
    setEditing({});
  }

  async function save() {
    try {
      await api("/api/admin/coupons", { method: "POST", body: form });
      toast("Coupon saved");
      setEditing(null);
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete code ${row.code}?`)) return;
    await api(`/api/admin/coupons/${row.id}/delete`, { method: "POST" });
    await reload();
  }

  return (
    <Card
      title={`${data.coupons.length} coupon codes`}
      hint="Validated on the server, so a discount can never be faked in the browser."
      actions={
        <Button size="sm" onClick={() => open(null)}>
          + New code
        </Button>
      }
    >
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Used</th>
              <th>Min order</th>
              <th>Expires</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.coupons.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.code}</strong>
                </td>
                <td>{row.kind === "flat" ? money(row.value) : `${row.value}%`}</td>
                <td>
                  {row.used}
                  {row.max_uses ? ` / ${row.max_uses}` : ""}
                </td>
                <td>{row.min_amount ? money(row.min_amount) : "—"}</td>
                <td>{row.expires_at ? prettyDate(row.expires_at) : "—"}</td>
                <td>
                  <StatusPill status={row.status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(row)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => remove(row)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!data.coupons.length ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  No codes yet. Make a 10% welcome code for the exit popup.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(editing)} title={form.id ? "Edit coupon" : "New coupon"} onClose={() => setEditing(null)} footer={<Button onClick={save}>Save coupon</Button>}>
        <div className="stack">
          <div className="two-col">
            <Field label="Code">
              <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="DIVA10" />
            </Field>
            <Field label="Type">
              <Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="percent">Percent off</option>
                <option value="flat">Flat amount off</option>
              </Select>
            </Field>
          </div>
          <div className="three-col">
            <Field label={form.kind === "flat" ? "Amount off" : "Percent off"}>
              <Input type="number" min="1" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
            </Field>
            <Field label="Minimum order" hint="0 = no minimum">
              <Input type="number" min="0" value={form.min_amount} onChange={(event) => setForm({ ...form, min_amount: event.target.value })} />
            </Field>
            <Field label="Max uses" hint="0 = unlimited">
              <Input type="number" min="0" value={form.max_uses} onChange={(event) => setForm({ ...form, max_uses: event.target.value })} />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Expires at">
              <Input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* --------------------------------- bundles -------------------------------- */

function Bundles({ data, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    title: "",
    subtitle: "",
    price: 199,
    mrp: 399,
    badge: "Bundle",
    cover: "",
    status: "active",
    sort: 0,
    ebook_ids: [],
  });

  function open(row) {
    setForm(
      row
        ? { ...row, ebook_ids: Array.isArray(row.ebook_ids) ? row.ebook_ids : parse(row.ebook_ids, []) }
        : { id: "", title: "", subtitle: "", price: 199, mrp: 399, badge: "Bundle", cover: "", status: "active", sort: data.bundles.length, ebook_ids: [] }
    );
    setEditing({});
  }

  function toggleBook(id) {
    setForm((current) => ({
      ...current,
      ebook_ids: current.ebook_ids.includes(id) ? current.ebook_ids.filter((entry) => entry !== id) : [...current.ebook_ids, id],
    }));
  }

  async function save() {
    try {
      await api("/api/admin/bundles", { method: "POST", body: form });
      toast("Bundle saved");
      setEditing(null);
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  return (
    <Card
      title={`${data.bundles.length} bundles`}
      hint="Group ebooks and set one price. Bucket discounts convert better than percent codes."
      actions={
        <Button size="sm" onClick={() => open(null)}>
          + New bundle
        </Button>
      }
    >
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Bundle</th>
              <th>Ebooks</th>
              <th>Price</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.bundles.map((row) => {
              const ids = Array.isArray(row.ebook_ids) ? row.ebook_ids : parse(row.ebook_ids, []);
              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <small className="cell-sub">{row.subtitle}</small>
                  </td>
                  <td>{ids.length}</td>
                  <td>
                    {money(row.price)}
                    {row.mrp > row.price ? <small className="cell-sub">was {money(row.mrp)}</small> : null}
                  </td>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger-text"
                        onClick={async () => {
                          if (!window.confirm("Delete this bundle?")) return;
                          await api(`/api/admin/bundles/${row.id}/delete`, { method: "POST" });
                          await reload();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!data.bundles.length ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  No bundles yet. Try “The Starter Vault” with 3 ebooks at the price of 2.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(editing)} title={form.id ? "Edit bundle" : "New bundle"} onClose={() => setEditing(null)} footer={<Button onClick={save}>Save bundle</Button>} wide>
        <div className="stack">
          <div className="two-col">
            <Field label="Title">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="The Starter Vault" />
            </Field>
            <Field label="Badge">
              <Input value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} />
            </Field>
          </div>
          <Field label="Subtitle">
            <Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
          </Field>
          <div className="three-col">
            <Field label="Bundle price">
              <Input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </Field>
            <Field label="Anchor MRP">
              <Input type="number" min="0" value={form.mrp} onChange={(event) => setForm({ ...form, mrp: event.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="active">Live</option>
                <option value="draft">Draft</option>
              </Select>
            </Field>
          </div>
          <Field label={`Ebooks in this bundle (${form.ebook_ids.length})`}>
            <div className="check-grid">
              {data.ebooks.map((row) => (
                <label key={row.id} className={`check-card${form.ebook_ids.includes(row.id) ? " on" : ""}`}>
                  <input type="checkbox" checked={form.ebook_ids.includes(row.id)} onChange={() => toggleBook(row.id)} />
                  <span>{row.title}</span>
                  <small>{money(row.price)}</small>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

/* --------------------------------- journal -------------------------------- */

function Journal({ data, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: "", title: "", slug: "", excerpt: "", body: "", cover: "", status: "draft" });

  function open(row) {
    setForm(row ? { ...row } : { id: "", title: "", slug: "", excerpt: "", body: "", cover: "", status: "draft" });
    setEditing({});
  }

  async function save() {
    try {
      await api("/api/admin/posts", { method: "POST", body: form });
      toast("Post saved");
      setEditing(null);
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  return (
    <Card
      title={`${data.posts.length} journal posts`}
      hint="Search traffic that warms people up before they buy. Markdown-lite: blank line = new paragraph, ## = heading."
      actions={
        <Button size="sm" onClick={() => open(null)}>
          + New post
        </Button>
      }
    >
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Published</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.posts.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.title}</strong>
                  <small className="cell-sub">/journal/{row.slug}</small>
                </td>
                <td>
                  <StatusPill status={row.status} />
                </td>
                <td>{row.published_at ? prettyDate(row.published_at) : "—"}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(row)}>
                      Edit
                    </button>
                    <a className="btn btn-ghost btn-sm" href={`/journal/${row.slug}`} target="_blank" rel="noreferrer">
                      View ↗
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm danger-text"
                      onClick={async () => {
                        if (!window.confirm("Delete this post?")) return;
                        await api(`/api/admin/posts/${row.id}/delete`, { method: "POST" });
                        await reload();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!data.posts.length ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  No posts yet. A 400-word note on “why your salary is not your income” is a good first one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(editing)} title={form.id ? "Edit post" : "New post"} onClose={() => setEditing(null)} footer={<Button onClick={save}>Save post</Button>} wide>
        <div className="stack">
          <div className="two-col">
            <Field label="Title">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </Field>
          </div>
          <Field label="Excerpt" hint="Shown on cards and in search results.">
            <Textarea rows={2} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} />
          </Field>
          <Field label="Cover image URL">
            <Input value={form.cover} onChange={(event) => setForm({ ...form, cover: event.target.value })} placeholder="/covers/cover-1.jpg" />
          </Field>
          <Field label="Body" hint={'Blank line = new paragraph. Start a line with "## " for a heading.'}>
            <Textarea rows={14} className="mono" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

/* ------------------------------- subscribers ------------------------------- */

function Subscribers({ data, reload }) {
  const rows = data.subscribers;
  return (
    <Card
      title={`${rows.length} subscribers`}
      hint="Everyone who joined the newsletter. Export and send from your email tool — no provider lock-in."
      actions={
        <a className="btn btn-secondary btn-sm" href="/api/admin/export/subscribers.csv">
          Export CSV
        </a>
      }
    >
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Source</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>{row.source}</td>
                <td>{prettyDate(row.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm danger-text"
                    onClick={async () => {
                      await api(`/api/admin/subscribers/${row.id}/delete`, { method: "POST" });
                      await reload();
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  No subscribers yet. The footer form and newsletter section feed this list.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* --------------------------------- reviews -------------------------------- */

function ReviewsQueue({ data, reload }) {
  const toast = useToast();
  const books = useMemo(() => Object.fromEntries((data.ebooks || []).map((row) => [row.id, row.title])), [data.ebooks]);
  const pending = data.reviews.filter((row) => row.status === "pending");

  async function act(row, action) {
    try {
      await api(`/api/admin/reviews/${row.id}`, { method: "POST", body: { action } });
      toast("Review updated");
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <Card title={`${pending.length} waiting for approval`} hint="Reviews come only from paid orders. Approve the honest ones — even the 4s.">
        <div className="review-queue">
          {pending.map((row) => (
            <div key={row.id} className="review-queue-item">
              <div>
                <strong>
                  {row.name} · {"★".repeat(row.rating || 5)} · {books[row.ebook_id] || "ebook"}
                </strong>
                <p>{row.body}</p>
                <small>
                  Order {row.order_ref} · {prettyDateTime(row.created_at)}
                </small>
              </div>
              <div className="row-actions">
                <Button size="sm" onClick={() => act(row, "activate")}>
                  Approve
                </Button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(row, "hide")}>
                  Hide
                </button>
                <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => act(row, "delete")}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!pending.length ? <p className="admin-muted">All clear — nothing waiting.</p> : null}
        </div>
      </Card>

      <Card title="Published reviews" hint="Shown on product pages and in the verified reviews section.">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Ebook</th>
                <th>Review</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.reviews
                .filter((row) => row.status !== "pending")
                .map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small className="cell-sub">{"★".repeat(row.rating || 5)}</small>
                    </td>
                    <td>{books[row.ebook_id] || "—"}</td>
                    <td className="clamp-cell">{row.body}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(row, row.status === "active" ? "hide" : "activate")}>
                          {row.status === "active" ? "Hide" : "Show"}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => act(row, "delete")}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!data.reviews.length ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No verified reviews yet. They appear after buyers review a paid order.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
