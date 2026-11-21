import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, money, prettyDate, prettyDateTime } from "../lib/api.jsx";
import Studio from "./Studio.jsx";
import AiStudio from "./AiStudio.jsx";
import Growth from "./Growth.jsx";
import Security from "./Security.jsx";
import {
  Button,
  CopyButton,
  Empty,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  StatusPill,
  Textarea,
  Toggle,
  useToast,
} from "../ui.jsx";

/* ------------------------------- entry ---------------------------------- */

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const loadSession = useCallback(async () => {
    try {
      setSession(await api("/api/admin/session"));
    } catch (err) {
      setError(err.message);
      setSession({ setup: false, admin: null });
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const result = await api("/api/admin/data");
      setData(result);
      setError("");
    } catch (err) {
      if (err.status === 401) {
        setData(null);
        setSession({ setup: false, admin: null });
      } else setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (session && session.admin) loadData();
  }, [session, loadData]);

  if (session === undefined) {
    return (
      <div className="boot">
        <div className="boot-mark">✿</div>
        <p>Opening your studio…</p>
      </div>
    );
  }

  if (session.setup) {
    return (
      <AccessScreen
        mode="setup"
        onDone={async () => {
          await loadSession();
        }}
      />
    );
  }

  if (!session.admin) {
    return (
      <AccessScreen
        mode="login"
        onDone={async () => {
          await loadSession();
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="boot">
        <div className="boot-mark">✿</div>
        <p>Loading your data…</p>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <AdminShell
      data={data}
      reload={loadData}
      onLogout={async () => {
        await api("/api/admin/logout", { method: "POST" });
        setData(null);
        setSession({ setup: false, admin: null });
      }}
    />
  );
}

function AccessScreen({ mode, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/${mode === "setup" ? "setup" : "login"}`, { method: "POST", body: form });
      toast(mode === "setup" ? "Admin created" : "Welcome back");
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="access-page">
      <div className="access-art">
        <div className="access-brand">✿ neverbasic diva</div>
        <h1>
          Your studio. <em>Your rules.</em>
        </h1>
        <p>
          Orders, PDFs, PayU, resellers, refunds and support — all in one place. Nothing here needs a
          developer.
        </p>
        <ul>
          <li>Upload a PDF, it goes live instantly</li>
          <li>Configure PayU keys or a payment link</li>
          <li>Every payment tracked, every download counted</li>
        </ul>
      </div>
      <div className="access-form">
        <div className="panel">
          <span className="eyebrow">{mode === "setup" ? "first time setup" : "admin access"}</span>
          <h2>{mode === "setup" ? "Create your admin login" : "Welcome back"}</h2>
          <p className="muted">
            {mode === "setup"
              ? "This is the only account that can manage the store. Store it somewhere safe."
              : "Sign in to manage orders, ebooks and payments."}
          </p>
          <form onSubmit={submit} className="stack">
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="username"
              />
            </Field>
            <Field label="Password" hint={mode === "setup" ? "At least 8 characters." : ""}>
              <Input
                type="password"
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete={mode === "setup" ? "new-password" : "current-password"}
              />
            </Field>
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" size="lg" loading={busy} className="btn-block">
              {mode === "setup" ? "Create admin & enter" : "Sign in"}
            </Button>
          </form>
          <p className="field-hint">
            <a href="/">← Back to the store</a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- shell --------------------------------- */

const SECTIONS = [
  ["overview", "Overview", "◈"],
  ["orders", "Orders", "▤"],
  ["ebooks", "Ebooks & PDFs", "❏"],
  ["ai", "AI studio", "✷"],
  ["growth", "Growth", "◎"],
  ["payments", "Payments", "₹"],
  ["resell", "Resellers", "↗"],
  ["tickets", "Support", "✉"],
  ["requests", "Requests", "✎"],
  ["refunds", "Refunds", "↺"],
  ["reviews", "Reviews", "★"],
  ["design", "Design studio", "◐"],
  ["content", "Site content", "✿"],
  ["security", "Security", "⛨"],
  ["account", "Account", "⚙"],
];

function AdminShell({ data, reload, onLogout }) {
  const [section, setSection] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
  const settings = data.settings || {};

  return (
    <div className="admin">
      <aside className={`admin-side ${navOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark">✿</span>
          <div>
            <strong>neverbasic diva</strong>
            <small>studio</small>
          </div>
        </div>
        <nav className="admin-nav">
          {SECTIONS.map(([key, label, glyph]) => (
            <button
              key={key}
              type="button"
              className={section === key ? "active" : ""}
              onClick={() => {
                setSection(key);
                setNavOpen(false);
              }}
            >
              <span className="glyph">{glyph}</span>
              {label}
              {key === "orders" && data.stats.pendingOrders ? (
                <span className="nav-dot">{data.stats.pendingOrders}</span>
              ) : null}
              {key === "tickets" && data.stats.openTickets ? (
                <span className="nav-dot">{data.stats.openTickets}</span>
              ) : null}
              {key === "refunds" && data.stats.openRefunds ? (
                <span className="nav-dot">{data.stats.openRefunds}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href="/" className="admin-side-link">
            ↗ View store
          </a>
          <button type="button" className="admin-side-link" onClick={onLogout}>
            Sign out
          </button>
          <small>{data.admin.email}</small>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <button type="button" className="admin-burger" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">
            ☰
          </button>
          <div>
            <span className="eyebrow">studio</span>
            <h1>{SECTIONS.find(([key]) => key === section)?.[1]}</h1>
          </div>
          <div className="admin-top-right">
            <span className="admin-live">
              <span className="live-dot" /> live
            </span>
            <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">
              Open site ↗
            </a>
          </div>
        </header>

        <div className="admin-body">
          {section === "overview" ? <Overview data={data} onGo={setSection} /> : null}
          {section === "orders" ? <Orders data={data} reload={reload} /> : null}
          {section === "ebooks" ? <Ebooks data={data} reload={reload} /> : null}
          {section === "ai" ? <AiStudio data={data} reload={reload} /> : null}
          {section === "growth" ? <Growth data={data} reload={reload} /> : null}
          {section === "payments" ? <Payments settings={settings} reload={reload} /> : null}
          {section === "resell" ? <ResellAdmin data={data} settings={settings} reload={reload} /> : null}
          {section === "tickets" ? <Tickets data={data} reload={reload} /> : null}
          {section === "requests" ? <Requests data={data} reload={reload} /> : null}
          {section === "refunds" ? <Refunds data={data} reload={reload} /> : null}
          {section === "reviews" ? <Reviews data={data} reload={reload} /> : null}
          {section === "design" ? <Studio settings={settings} reload={reload} /> : null}
          {section === "content" ? <Content settings={settings} reload={reload} /> : null}
          {section === "security" ? <Security data={data} reload={reload} /> : null}
          {section === "account" ? <Account reload={reload} admin={data.admin} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- shared --------------------------------- */

function useDraft(settings, keys) {
  const signature = keys.join("|");
  const [draft, setDraft] = useState(() => {
    const next = {};
    keys.forEach((key) => {
      next[key] = settings[key] ?? "";
    });
    return next;
  });
  useEffect(() => {
    const next = {};
    signature.split("|").forEach((key) => {
      next[key] = settings[key] ?? "";
    });
    setDraft(next);
  }, [signature, settings]);
  return [draft, setDraft];
}

async function saveSettings(patch, reload, toast) {
  try {
    await api("/api/admin/settings", { method: "POST", body: patch });
    toast("Saved");
    await reload();
  } catch (err) {
    toast(err.message, "bad");
  }
}

function SectionCard({ title, subtitle, children, actions }) {
  return (
    <section className="admin-card">
      {(title || actions) && (
        <div className="admin-card-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="admin-card-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

function DataTable({ head, children, empty }) {
  const rows = React.Children.toArray(children);
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={head.length}>
                <div className="table-empty">{empty || "Nothing here yet."}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- overview ------------------------------- */

function Overview({ data, onGo }) {
  const stats = data.stats;
  const max = Math.max(1, ...stats.series.map((point) => Number(point.revenue) || 0));
  const funnel = Object.fromEntries(stats.funnel.map((row) => [row.status, row.n]));
  const totalOrders = stats.funnel.reduce((sum, row) => sum + Number(row.n), 0) || 1;

  return (
    <div className="stack-lg">
      <div className="stat-cards">
        {[
          ["Revenue", money(stats.revenue), `${money(stats.revenueToday)} today`],
          ["Paid orders", stats.paidOrders, `${stats.pendingOrders} pending`],
          ["Downloads", stats.downloads, "tracked deliveries"],
          ["Visitors this week", stats.visitsWeek, "page views"],
          ["Active resellers", stats.activeResellers, "licences live"],
          ["Open support", stats.openTickets + stats.openRefunds + stats.newRequests, "needs attention"],
        ].map(([label, value, hint]) => (
          <div key={label} className="stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="admin-grid-2">
        <SectionCard title="Revenue, last 14 selling days">
          {stats.series.length ? (
            <div className="bars">
              {stats.series.map((point) => (
                <div key={point.day} className="bar-col" title={`${point.day} · ${money(point.revenue)} · ${point.orders} orders`}>
                  <span className="bar" style={{ height: `${Math.max(6, (Number(point.revenue) / max) * 100)}%` }} />
                  <small>{String(point.day).slice(5)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-muted">No paid orders yet. Share your library link and the first one will land here.</p>
          )}
        </SectionCard>

        <SectionCard title="Order funnel">
          {["paid", "pending", "failed", "refunded", "cancelled"].map((status) => (
            <div key={status} className="funnel-row">
              <span className="funnel-label">
                <StatusPill status={status} />
              </span>
              <div className="funnel-track">
                <span style={{ width: `${((funnel[status] || 0) / totalOrders) * 100}%` }} />
              </div>
              <strong>{funnel[status] || 0}</strong>
            </div>
          ))}
        </SectionCard>
      </div>

      <div className="admin-grid-2">
        <SectionCard
          title="Recent orders"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo("orders")}>
              All orders
            </button>
          }
        >
          <div className="mini-list">
            {(data.orders || []).slice(0, 6).map((order) => (
              <div key={order.ref} className="mini-row">
                <div>
                  <strong>{order.name}</strong>
                  <small>
                    {order.item_title} · {prettyDate(order.created_at)}
                  </small>
                </div>
                <div className="mini-row-right">
                  <span>{money(order.amount)}</span>
                  <StatusPill status={order.status} />
                </div>
              </div>
            ))}
            {!data.orders.length ? <p className="admin-muted">No orders yet.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Best sellers">
          <div className="mini-list">
            {stats.top.map((row) => (
              <div key={row.item_title} className="mini-row">
                <div>
                  <strong>{row.item_title}</strong>
                  <small>{row.orders} paid · {money(row.revenue)}</small>
                </div>
                <span className="mini-badge">↗</span>
              </div>
            ))}
            {!stats.top.length ? <p className="admin-muted">No sales yet.</p> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Quick actions">
        <div className="quick-actions">
          <button type="button" className="quick" onClick={() => onGo("ebooks")}>
            <strong>Upload a PDF</strong>
            <span>Publish a new ebook in under a minute</span>
          </button>
          <button type="button" className="quick" onClick={() => onGo("payments")}>
            <strong>Connect PayU</strong>
            <span>Add key + salt, switch to live when ready</span>
          </button>
          <button type="button" className="quick" onClick={() => onGo("orders")}>
            <strong>Verify a UPI payment</strong>
            <span>Check UTRs and unlock access</span>
          </button>
          <button type="button" className="quick" onClick={() => onGo("content")}>
            <strong>Edit site copy</strong>
            <span>Hero, colours, policies, FAQs</span>
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/* -------------------------------- orders -------------------------------- */

function Orders({ data, reload }) {
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [txnid, setTxnid] = useState("");
  const [note, setNote] = useState("");

  const orders = data.orders.filter((order) => {
    const matchesStatus = filter === "all" || order.status === filter;
    const term = query.trim().toLowerCase();
    const matchesQuery =
      !term ||
      [order.ref, order.name, order.email, order.item_title, order.utr].join(" ").toLowerCase().includes(term);
    return matchesStatus && matchesQuery;
  });

  async function act(order, action, extra = {}) {
    try {
      await api(`/api/admin/orders/${encodeURIComponent(order.ref)}`, {
        method: "POST",
        body: { action, ...extra },
      });
      toast("Order updated");
      setActive(null);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title={`${data.orders.length} orders`}
        subtitle="Every payment, download and reference in one place."
        actions={
          <a className="btn btn-ghost btn-sm" href="/api/admin/export/orders.csv">
            Export CSV ↓
          </a>
        }
      >
        <div className="toolbar">
          <div className="filter-row compact">
            {["all", "pending", "paid", "failed", "refunded", "cancelled"].map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-pill ${filter === status ? "active" : ""}`}
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <Input
            className="search-input"
            placeholder="Search ref, name, email, UTR…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <DataTable head={["Reference", "Buyer", "Item", "Amount", "Status", "Mode", "Placed", ""]}>
          {orders.map((order) => (
            <tr key={order.ref}>
              <td>
                <code className="ref-code">{order.ref}</code>
              </td>
              <td>
                <strong>{order.name}</strong>
                <small className="cell-sub">{order.email}</small>
              </td>
              <td>
                {order.item_title}
                <small className="cell-sub">{order.kind === "resell" ? "Resell licence" : "Ebook"}</small>
              </td>
              <td>{money(order.amount)}</td>
              <td>
                <StatusPill status={order.status} />
              </td>
              <td>
                {order.payment_mode}
                {order.utr ? <small className="cell-sub">UTR {order.utr}</small> : null}
              </td>
              <td>{prettyDate(order.created_at)}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setActive(order);
                    setTxnid(order.payu_txnid || "");
                    setNote(order.notes || "");
                  }}
                >
                  Manage
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <Modal
        open={Boolean(active)}
        title={active ? `Order ${active.ref}` : ""}
        onClose={() => setActive(null)}
        wide
      >
        {active ? (
          <div className="stack">
            <div className="order-detail-grid">
              <div>
                <small>Buyer</small>
                <strong>{active.name}</strong>
                <span>{active.email}</span>
                <span>{active.phone}</span>
              </div>
              <div>
                <small>Item</small>
                <strong>{active.item_title}</strong>
                <span>{money(active.amount)}</span>
              </div>
              <div>
                <small>Status</small>
                <StatusPill status={active.status} />
                <span>{active.paid_at ? `Paid ${prettyDateTime(active.paid_at)}` : "Not paid yet"}</span>
              </div>
              <div>
                <small>Delivery</small>
                <strong>{active.downloads} downloads</strong>
                <span>{active.utr ? `UTR ${active.utr}` : "No UTR submitted"}</span>
              </div>
            </div>

            {active.status === "paid" ? (
              <div className="inline-actions">
                <a className="btn btn-secondary btn-sm" href={`/api/download/${active.download_token}`}>
                  Test download ↘
                </a>
                <CopyButton value={`${window.location.origin}/api/download/${active.download_token}`} label="Copy access link" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(active, "resend")}>
                  Refresh link
                </button>
              </div>
            ) : null}

            {active.status === "pending" || active.status === "failed" ? (
              <div className="boxed">
                <h4>Confirm payment</h4>
                <p className="admin-muted">
                  Match the UTR {active.utr ? <strong>({active.utr})</strong> : "submitted by the buyer"} in your
                  PayU / bank dashboard, then unlock access.
                </p>
                <div className="inline-form">
                  <Input
                    placeholder="PayU txn id / UTR (optional)"
                    value={txnid}
                    onChange={(event) => setTxnid(event.target.value)}
                  />
                  <Button size="sm" onClick={() => act(active, "mark_paid", { txnid })}>
                    Mark paid &amp; unlock
                  </Button>
                </div>
              </div>
            ) : null}

            <Field label="Internal note">
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="inline-actions">
              <Button size="sm" variant="secondary" onClick={() => act(active, "note", { note })}>
                Save note
              </Button>
              {active.status === "paid" ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`Refund ${money(active.amount)} and revoke access?`)) act(active, "refund", { note });
                  }}
                >
                  Refund order
                </Button>
              ) : null}
              {active.status === "pending" ? (
                <Button size="sm" variant="ghost" onClick={() => act(active, "cancel")}>
                  Cancel order
                </Button>
              ) : null}
            </div>
            {active.reseller_code ? <p className="field-hint">Referred by reseller {active.reseller_code}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* -------------------------------- ebooks -------------------------------- */

const blankEbook = {
  id: "",
  title: "",
  subtitle: "",
  description: "",
  highlights: "",
  category: "Money",
  pages: 30,
  price: 99,
  mrp: 399,
  cover: "",
  file_key: "",
  file_name: "",
  file_size: 0,
  status: "active",
  featured: 1,
  badge: "",
  sort: 0,
};

function Ebooks({ data, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankEbook);
  const [busy, setBusy] = useState(false);

  function open(ebook) {
    if (ebook) {
      setForm({
        ...ebook,
        highlights: Array.isArray(ebook.highlights) ? ebook.highlights.join("\n") : parseHighlights(ebook.highlights),
      });
    } else setForm(blankEbook);
    setEditing(ebook || {});
  }

  function parseHighlights(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed.join("\n") : "";
    } catch {
      return "";
    }
  }

  async function uploadFile(kind, file) {
    if (!file) return;
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);
    try {
      const result = await api("/api/admin/upload", { method: "POST", form: body });
      if (kind === "file") {
        setForm((current) => ({
          ...current,
          file_key: result.key,
          file_name: result.name,
          file_size: result.size,
        }));
        toast("PDF uploaded — save to publish it");
      } else {
        setForm((current) => ({ ...current, cover: result.url }));
        toast("Cover uploaded");
      }
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/ebooks", { method: "POST", body: form });
      toast("Ebook saved");
      setEditing(null);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove(ebook) {
    if (!window.confirm(`Delete "${ebook.title}"? Paid buyers keep their downloads.`)) return;
    try {
      await api(`/api/admin/ebooks/${ebook.id}/delete`, { method: "POST" });
      toast("Deleted");
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title={`${data.ebooks.length} ebooks`}
        subtitle="Upload the PDF, set the price, publish. Buyers get the real file the moment you save."
        actions={
          <Button size="sm" onClick={() => open(null)}>
            + New ebook
          </Button>
        }
      >
        <DataTable head={["Cover", "Title", "Price", "Status", "File", "Sales", ""]}>
          {data.ebooks.map((ebook) => {
            const sales = data.orders.filter((order) => order.ebook_id === ebook.id && order.status === "paid").length;
            return (
              <tr key={ebook.id}>
                <td>
                  <img className="table-cover" src={ebook.cover || "/favicon.svg"} alt="" />
                </td>
                <td>
                  <strong>{ebook.title}</strong>
                  <small className="cell-sub">
                    {ebook.category} · {ebook.pages} pages {ebook.featured ? "· featured" : ""}
                  </small>
                </td>
                <td>{money(ebook.price)}</td>
                <td>
                  <StatusPill status={ebook.status} />
                </td>
                <td>
                  {ebook.file_key && !String(ebook.file_key).startsWith("demo:") ? (
                    <span className="file-ok">PDF ready</span>
                  ) : (
                    <span className="file-warn">preview</span>
                  )}
                </td>
                <td>{sales}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(ebook)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => remove(ebook)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </SectionCard>

      <Modal
        open={Boolean(editing)}
        title={form.id ? "Edit ebook" : "New ebook"}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Save ebook
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="two-col">
            <Field label="Title">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Subtitle">
              <Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="What's inside" hint="One line per bullet, maximum 10.">
            <Textarea rows={5} value={form.highlights} onChange={(event) => setForm({ ...form, highlights: event.target.value })} />
          </Field>
          <div className="three-col">
            <Field label="Price (₹)">
              <Input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </Field>
            <Field label="MRP (₹)" hint="Strikethrough price.">
              <Input type="number" value={form.mrp} onChange={(event) => setForm({ ...form, mrp: event.target.value })} />
            </Field>
            <Field label="Pages">
              <Input type="number" value={form.pages} onChange={(event) => setForm({ ...form, pages: event.target.value })} />
            </Field>
          </div>
          <div className="three-col">
            <Field label="Category">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </Field>
            <Field label="Badge" hint="e.g. Bestseller">
              <Input value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} />
            </Field>
            <Field label="Sort order">
              <Input type="number" value={form.sort} onChange={(event) => setForm({ ...form, sort: event.target.value })} />
            </Field>
          </div>

          <div className="upload-grid">
            <div className="upload-box">
              <h4>Cover image</h4>
              {form.cover ? <img className="upload-preview" src={form.cover} alt="cover preview" /> : <p className="admin-muted">No cover yet</p>}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => uploadFile("cover", event.target.files?.[0])}
              />
              <Field label="Or paste an image URL">
                <Input value={form.cover} onChange={(event) => setForm({ ...form, cover: event.target.value })} placeholder="/covers/cover-1.jpg" />
              </Field>
            </div>
            <div className="upload-box">
              <h4>PDF file</h4>
              {form.file_key && !String(form.file_key).startsWith("demo:") ? (
                <p className="file-ok">{form.file_name}</p>
              ) : (
                <p className="file-warn">Preview placeholder — upload the real PDF before selling.</p>
              )}
              <input type="file" accept="application/pdf" onChange={(event) => uploadFile("file", event.target.files?.[0])} />
              <p className="field-hint">Up to 25MB. Stored privately; buyers get a tracked, expiring-free link.</p>
            </div>
          </div>

          <div className="two-col">
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="active">Active (visible)</option>
                <option value="draft">Draft (hidden)</option>
              </Select>
            </Field>
            <div className="field">
              <span className="field-label">Featured on home</span>
              <Toggle
                checked={Boolean(Number(form.featured))}
                onChange={(value) => setForm({ ...form, featured: value ? 1 : 0 })}
                label="Show in the home hero + library"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------- payments ------------------------------- */

function Payments({ settings, reload }) {
  const toast = useToast();
  const [draft, setDraft] = useDraft(settings, [
    "payu_enabled",
    "payu_key",
    "payu_salt",
    "payu_mode",
    "payment_link",
    "upi_id",
    "pay_instructions",
    "payment_gateway",
    "currency",
    "currency_symbol",
    "razorpay_enabled",
    "razorpay_key_id",
    "razorpay_key_secret",
    "stripe_enabled",
    "stripe_publishable_key",
    "stripe_secret_key",
  ]);
  const [showSalt, setShowSalt] = useState(false);
  const [showRzp, setShowRzp] = useState(false);
  const [showStripe, setShowStripe] = useState(false);
  const [testState, setTestState] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const payuReady = draft.payu_enabled === "1" && draft.payu_key && draft.payu_salt;
  const razorpayReady = draft.razorpay_enabled === "1" && draft.razorpay_key_id && draft.razorpay_key_secret;
  const stripeReady = draft.stripe_enabled === "1" && draft.stripe_secret_key;
  const activeGateway =
    draft.payment_gateway && draft.payment_gateway !== "auto"
      ? draft.payment_gateway
      : payuReady
        ? "payu"
        : razorpayReady
          ? "razorpay"
          : stripeReady
            ? "stripe"
            : draft.payment_link
              ? "link"
              : draft.upi_id
                ? "upi"
                : "manual";

  async function testGateways() {
    setTestBusy(true);
    setTestState(null);
    try {
      const result = await api("/api/admin/payments/test", { method: "POST" });
      setTestState(result);
      toast(`Active gateway: ${result.primary}`);
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title="Payment gateway"
        subtitle="Connect PayU, or run on a payment link / UPI while you wait for activation."
        actions={
          <Button size="sm" onClick={() => saveSettings(draft, reload, toast)}>
            Save payment settings
          </Button>
        }
      >
        <div className="status-line">
          <span className={payuReady ? "dot good" : "dot warn"} />
          {payuReady
            ? `PayU is ${draft.payu_mode === "live" ? "LIVE — real payments" : "in test mode"}`
            : "PayU is off — buyers will use the payment link / UPI flow"}
        </div>

        <Toggle
          checked={draft.payu_enabled === "1"}
          onChange={(value) => setDraft({ ...draft, payu_enabled: value ? "1" : "0" })}
          label="Enable PayU checkout"
          hint="When off, orders fall back to your payment link or UPI reference flow."
        />

        <div className="two-col">
          <Field label="PayU merchant key">
            <Input value={draft.payu_key} onChange={(event) => setDraft({ ...draft, payu_key: event.target.value })} placeholder="e.g. 3TnMkL" />
          </Field>
          <Field label="PayU salt">
            <div className="input-with-action">
              <Input
                type={showSalt ? "text" : "password"}
                value={draft.payu_salt}
                onChange={(event) => setDraft({ ...draft, payu_salt: event.target.value })}
              />
              <button type="button" className="input-action" onClick={() => setShowSalt(!showSalt)}>
                {showSalt ? "hide" : "show"}
              </button>
            </div>
          </Field>
        </div>
        <div className="two-col">
          <Field label="Mode">
            <Select value={draft.payu_mode} onChange={(event) => setDraft({ ...draft, payu_mode: event.target.value })}>
              <option value="test">Test (test.payu.in)</option>
              <option value="live">Live (secure.payu.in)</option>
            </Select>
          </Field>
          <Field label="Success / failure URL" hint="Add this inside your PayU dashboard if it asks.">
            <Input readOnly value={`${window.location.origin}/api/payu/return`} />
          </Field>
        </div>
        <div className="info-block">
          <h4>How verification works</h4>
          <p>
            The site creates a SHA-512 request hash on the server, sends the buyer to PayU, then verifies the
            reverse hash on return <em>and</em> checks the amount before unlocking the PDF. A tampered or
            unpaid response never unlocks a file — it is logged on the order timeline instead.
          </p>
          <p className="field-hint">
            Webhook endpoint (optional): <code>{`${window.location.origin}/api/payu/webhook`}</code>
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Backup payment flow"
        subtitle="Used automatically when PayU is off, or when a buyer prefers UPI."
        actions={
          <Button size="sm" variant="secondary" onClick={() => saveSettings(draft, reload, toast)}>
            Save
          </Button>
        }
      >
        <div className="two-col">
          <Field label="Payment link" hint="PayU payment link, Razorpay link, Instamojo — any URL.">
            <Input value={draft.payment_link} onChange={(event) => setDraft({ ...draft, payment_link: event.target.value })} placeholder="https://…" />
          </Field>
          <Field label="UPI ID" hint="Shown on the order page so buyers can pay directly.">
            <Input value={draft.upi_id} onChange={(event) => setDraft({ ...draft, upi_id: event.target.value })} placeholder="neverbasicdiva@upi" />
          </Field>
        </div>
        <Field label="Instructions shown after order creation">
          <Textarea
            rows={3}
            value={draft.pay_instructions}
            onChange={(event) => setDraft({ ...draft, pay_instructions: event.target.value })}
          />
        </Field>
        <p className="field-hint">
          Buyers paste their UTR on the order page. You verify it in Orders → Manage → Mark paid, and access
          unlocks instantly.
        </p>
      </SectionCard>

      <SectionCard
        title="Razorpay (cards, UPI, wallets)"
        subtitle="Paste the key id and secret from Razorpay → Settings → API keys. Test or live keys both work instantly."
        actions={
          <Button size="sm" onClick={() => saveSettings(draft, reload, toast)}>
            Save
          </Button>
        }
      >
        <div className="status-line">
          <span className={razorpayReady ? "dot good" : "dot warn"} />
          {razorpayReady ? "Razorpay is connected" : "Razorpay is off"}
        </div>
        <Toggle
          checked={draft.razorpay_enabled === "1"}
          onChange={(value) => setDraft({ ...draft, razorpay_enabled: value ? "1" : "0" })}
          label="Enable Razorpay checkout"
          hint="Opens Razorpay's secure window; the signature is verified server-side before unlocking."
        />
        <div className="two-col">
          <Field label="Key id">
            <Input value={draft.razorpay_key_id} onChange={(event) => setDraft({ ...draft, razorpay_key_id: event.target.value })} placeholder="rzp_live_…" />
          </Field>
          <Field label="Key secret">
            <div className="input-with-action">
              <Input
                type={showRzp ? "text" : "password"}
                value={draft.razorpay_key_secret}
                onChange={(event) => setDraft({ ...draft, razorpay_key_secret: event.target.value })}
                autoComplete="off"
              />
              <button type="button" className="input-action" onClick={() => setShowRzp(!showRzp)}>
                {showRzp ? "hide" : "show"}
              </button>
            </div>
          </Field>
        </div>
        <p className="field-hint">No webhook needed — the browser returns Razorpay's signature and the server verifies it plus the order id before unlocking.</p>
      </SectionCard>

      <SectionCard
        title="Stripe (hosted checkout)"
        subtitle="Paste the secret key. Buyers are redirected to Stripe's hosted page and come back verified."
        actions={
          <Button size="sm" onClick={() => saveSettings(draft, reload, toast)}>
            Save
          </Button>
        }
      >
        <div className="status-line">
          <span className={stripeReady ? "dot good" : "dot warn"} />
          {stripeReady ? "Stripe is connected" : "Stripe is off"}
        </div>
        <Toggle
          checked={draft.stripe_enabled === "1"}
          onChange={(value) => setDraft({ ...draft, stripe_enabled: value ? "1" : "0" })}
          label="Enable Stripe checkout"
          hint="Payment is checked against the paid amount before access unlocks."
        />
        <div className="two-col">
          <Field label="Publishable key" hint="Optional — only shown to the browser if you use Stripe.js elsewhere.">
            <Input value={draft.stripe_publishable_key} onChange={(event) => setDraft({ ...draft, stripe_publishable_key: event.target.value })} placeholder="pk_live_…" />
          </Field>
          <Field label="Secret key">
            <div className="input-with-action">
              <Input
                type={showStripe ? "text" : "password"}
                value={draft.stripe_secret_key}
                onChange={(event) => setDraft({ ...draft, stripe_secret_key: event.target.value })}
                autoComplete="off"
              />
              <button type="button" className="input-action" onClick={() => setShowStripe(!showStripe)}>
                {showStripe ? "hide" : "show"}
              </button>
            </div>
          </Field>
        </div>
        <div className="info-block">
          <p className="field-hint">
            Optional webhook: <code>{`${window.location.origin}/api/stripe/webhook`}</code> — subscribes to
            <code> checkout.session.completed</code>. Stripe signs every call; unsigned calls are rejected.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Routing, currency & testing"
        subtitle="Choose which gateway buyers see, set the currency, and verify your keys with one click."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={testGateways} loading={testBusy}>
              Test gateways
            </Button>
            <Button size="sm" onClick={() => saveSettings(draft, reload, toast)}>
              Save
            </Button>
          </>
        }
      >
        <div className="status-line">
          <span className="dot good" />
          Buyers will currently pay via <strong>{activeGateway}</strong>
        </div>
        <div className="three-col">
          <Field label="Gateway priority">
            <Select value={draft.payment_gateway || "auto"} onChange={(event) => setDraft({ ...draft, payment_gateway: event.target.value })}>
              <option value="auto">Auto — first one connected</option>
              <option value="payu">PayU</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
              <option value="link">Payment link / UPI only</option>
              <option value="manual">Manual verification only</option>
            </Select>
          </Field>
          <Field label="Currency code">
            <Input value={draft.currency || "INR"} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} maxLength={3} />
          </Field>
          <Field label="Currency symbol">
            <Input value={draft.currency_symbol || "₹"} onChange={(event) => setDraft({ ...draft, currency_symbol: event.target.value })} maxLength={4} />
          </Field>
        </div>
        {testState ? (
          <div className="gateway-test">
            {Object.entries(testState.gateways || {}).map(([id, result]) => (
              <div key={id} className={`gateway-test-row ${result.ok ? "good" : "warn"}`}>
                <strong>{id}</strong>
                <span>{result.message}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="field-hint">
          Save first, then test. If a gateway is down or a key is wrong, checkout automatically falls back to
          your payment link or UPI so no order is ever lost.
        </p>
      </SectionCard>
    </div>
  );
}

/* -------------------------------- resell -------------------------------- */

function ResellAdmin({ data, settings, reload }) {
  const toast = useToast();
  const [draft, setDraft] = useDraft(settings, ["resell_enabled", "resell_price", "resell_commission_note"]);

  async function act(reseller, action) {
    try {
      await api(`/api/admin/resellers/${encodeURIComponent(reseller.ref)}`, { method: "POST", body: { action } });
      toast("Licence updated");
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title="Resell programme"
        subtitle="One-time licence, one year. Buyers get a code, a tracked link and the sellable PDFs."
        actions={
          <Button size="sm" onClick={() => saveSettings(draft, reload, toast)}>
            Save programme
          </Button>
        }
      >
        <div className="three-col">
          <Field label="Licence price (₹)">
            <Input value={draft.resell_price} onChange={(event) => setDraft({ ...draft, resell_price: event.target.value })} />
          </Field>
          <div className="field">
            <span className="field-label">Programme status</span>
            <Toggle
              checked={draft.resell_enabled === "1"}
              onChange={(value) => setDraft({ ...draft, resell_enabled: value ? "1" : "0" })}
              label={draft.resell_enabled === "1" ? "Open for applications" : "Closed"}
            />
          </div>
          <Field label="Licence note">
            <Input value={draft.resell_commission_note} onChange={(event) => setDraft({ ...draft, resell_commission_note: event.target.value })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={`${data.resellers.length} resellers`} subtitle="Activate, extend or revoke any licence.">
        <DataTable head={["Code", "Reseller", "Instagram", "Status", "Expires", "Clicks", "Sales", ""]}>
          {data.resellers.map((reseller) => (
            <tr key={reseller.ref}>
              <td>
                <code className="ref-code">{reseller.code}</code>
              </td>
              <td>
                <strong>{reseller.name}</strong>
                <small className="cell-sub">{reseller.email}</small>
              </td>
              <td>{reseller.instagram || "—"}</td>
              <td>
                <StatusPill status={reseller.status} />
              </td>
              <td>{reseller.expires_at ? prettyDate(reseller.expires_at) : "—"}</td>
              <td>{reseller.clicks}</td>
              <td>{reseller.sales}</td>
              <td>
                <div className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(reseller, "extend")}>
                    +1 year
                  </button>
                  {reseller.status === "active" ? (
                    <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => act(reseller, "revoke")}>
                      Revoke
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(reseller, "activate")}>
                      Activate
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>
    </div>
  );
}

/* -------------------------------- tickets -------------------------------- */

function Tickets({ data, reload }) {
  const toast = useToast();
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");

  async function open(ticket) {
    setActive(ticket);
    setReply("");
    try {
      setThread(await api(`/api/admin/tickets/${encodeURIComponent(ticket.ref)}`));
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function send(status) {
    if (!reply.trim()) return;
    try {
      await api(`/api/admin/tickets/${encodeURIComponent(active.ref)}/reply`, {
        method: "POST",
        body: { body: reply, status },
      });
      toast("Reply sent");
      setReply("");
      await open(active);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard title={`${data.tickets.length} support tickets`} subtitle="Replies appear instantly on the buyer's ticket page.">
        <DataTable head={["Ticket", "From", "Subject", "Status", "Updated", ""]}>
          {data.tickets.map((ticket) => (
            <tr key={ticket.ref}>
              <td>
                <code className="ref-code">{ticket.ref}</code>
              </td>
              <td>
                <strong>{ticket.name}</strong>
                <small className="cell-sub">{ticket.email}</small>
              </td>
              <td>
                {ticket.subject}
                {ticket.order_ref ? <small className="cell-sub">Order {ticket.order_ref}</small> : null}
              </td>
              <td>
                <StatusPill status={ticket.status} />
              </td>
              <td>{prettyDate(ticket.updated_at)}</td>
              <td>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(ticket)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <Modal open={Boolean(active)} title={active ? `${active.ref} · ${active.subject}` : ""} onClose={() => setActive(null)} wide>
        {thread ? (
          <div className="stack">
            <div className="messages">
              {thread.messages.map((message, index) => (
                <div key={index} className={`message ${message.author}`}>
                  <span className="message-author">{message.author === "admin" ? "You" : thread.ticket.name}</span>
                  <p>{message.body}</p>
                  <small>{prettyDateTime(message.created_at)}</small>
                </div>
              ))}
            </div>
            <Field label="Reply">
              <Textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write the response…" />
            </Field>
            <div className="inline-actions">
              <Button size="sm" onClick={() => send("answered")}>
                Send reply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => send("closed")}>
                Reply &amp; close
              </Button>
              <a className="btn btn-ghost btn-sm" href={`mailto:${thread.ticket.email}`}>
                Email buyer
              </a>
            </div>
          </div>
        ) : (
          <Spinner />
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------- requests ------------------------------- */

function Requests({ data, reload }) {
  const toast = useToast();
  const [active, setActive] = useState(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("contacted");

  async function save() {
    try {
      await api(`/api/admin/requests/${active.id}`, { method: "POST", body: { status, admin_note: note } });
      toast("Request updated");
      setActive(null);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard title={`${data.requests.length} ebook requests`} subtitle="What readers wish existed. Build the next ebook from here.">
        <DataTable head={["Who", "Topic", "Budget", "Status", "Received", ""]}>
          {data.requests.map((request) => (
            <tr key={request.id}>
              <td>
                <strong>{request.name}</strong>
                <small className="cell-sub">{request.email}</small>
              </td>
              <td>
                {request.topic || "—"}
                <small className="cell-sub">{String(request.message || "").slice(0, 70)}…</small>
              </td>
              <td>{request.budget || "—"}</td>
              <td>
                <StatusPill status={request.status} />
              </td>
              <td>{prettyDate(request.created_at)}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setActive(request);
                    setNote(request.admin_note || "");
                    setStatus(request.status || "contacted");
                  }}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <Modal open={Boolean(active)} title="Ebook request" onClose={() => setActive(null)} wide>
        {active ? (
          <div className="stack">
            <div className="boxed">
              <h4>{active.topic}</h4>
              <p>{active.message}</p>
              <p className="field-hint">
                {active.name} · {active.email} {active.whatsapp ? `· ${active.whatsapp}` : ""}
              </p>
            </div>
            <div className="two-col">
              <Field label="Status">
                <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="building">Building it</option>
                  <option value="done">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Field label="Internal note">
                <Input value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
            </div>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* -------------------------------- refunds -------------------------------- */

function Refunds({ data, reload }) {
  const toast = useToast();
  const [active, setActive] = useState(null);
  const [note, setNote] = useState("");

  async function act(action) {
    try {
      await api(`/api/admin/refunds/${encodeURIComponent(active.ref)}`, {
        method: "POST",
        body: { action, note },
      });
      toast("Refund updated");
      setActive(null);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title={`${data.refunds.length} refund requests`}
        subtitle="First send matched material, then refund if it still misses. That's the promise."
      >
        <DataTable head={["Refund", "Order", "Buyer", "Preference", "Status", "Requested", ""]}>
          {data.refunds.map((refund) => (
            <tr key={refund.ref}>
              <td>
                <code className="ref-code">{refund.ref}</code>
              </td>
              <td>{refund.order_ref}</td>
              <td>
                <strong>{refund.name}</strong>
                <small className="cell-sub">{refund.email}</small>
              </td>
              <td>{String(refund.reason).startsWith("[Preference: refund]") ? "Refund" : "Material"}</td>
              <td>
                <StatusPill status={refund.status} />
              </td>
              <td>{prettyDate(refund.created_at)}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setActive(refund);
                    setNote(refund.admin_note || "");
                  }}
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <Modal open={Boolean(active)} title="Refund review" onClose={() => setActive(null)} wide>
        {active ? (
          <div className="stack">
            <div className="boxed">
              <h4>What they said</h4>
              <p>{active.reason}</p>
              <p className="field-hint">
                Order {active.order_ref} · {active.email}
              </p>
            </div>
            <Field label="Note to buyer">
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="inline-actions">
              <Button size="sm" variant="secondary" onClick={() => act("material")}>
                Mark material sent
              </Button>
              <Button size="sm" onClick={() => act("approve")}>
                Approve 100% refund
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act("reject")}>
                Reject
              </Button>
            </div>
            <p className="field-hint">Approving marks the matching order as refunded and closes the request.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* -------------------------------- reviews ------------------------------- */

function Reviews({ data, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: "", name: "", handle: "", body: "", rating: 5, status: "active", sort: 0 });

  async function save() {
    try {
      await api("/api/admin/testimonials", { method: "POST", body: form });
      toast("Review saved");
      setEditing(null);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function remove(item) {
    if (!window.confirm("Delete this review?")) return;
    try {
      await api(`/api/admin/testimonials/${item.id}/delete`, { method: "POST" });
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title={`${data.testimonials.length} reviews`}
        subtitle="Shown on the home page. Hide any that stop feeling true."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setForm({ id: "", name: "", handle: "", body: "", rating: 5, status: "active", sort: 0 });
              setEditing({});
            }}
          >
            + Add review
          </Button>
        }
      >
        <DataTable head={["Name", "Handle", "Review", "Rating", "Status", ""]}>
          {data.testimonials.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
              </td>
              <td>{item.handle}</td>
              <td className="clamp-cell">{item.body}</td>
              <td>{"★".repeat(item.rating || 5)}</td>
              <td>
                <StatusPill status={item.status} />
              </td>
              <td>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setForm(item);
                      setEditing(item);
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => remove(item)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <Modal open={Boolean(editing)} title="Review" onClose={() => setEditing(null)}>
        <div className="stack">
          <div className="two-col">
            <Field label="Name">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Instagram handle">
              <Input value={form.handle} onChange={(event) => setForm({ ...form, handle: event.target.value })} />
            </Field>
          </div>
          <Field label="Review">
            <Textarea rows={3} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
          <div className="three-col">
            <Field label="Rating">
              <Input type="number" min="1" max="5" value={form.rating} onChange={(event) => setForm({ ...form, rating: event.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="active">Visible</option>
                <option value="hidden">Hidden</option>
              </Select>
            </Field>
            <Field label="Sort">
              <Input type="number" value={form.sort} onChange={(event) => setForm({ ...form, sort: event.target.value })} />
            </Field>
          </div>
          <Button onClick={save}>Save review</Button>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------- content -------------------------------- */

function Content({ settings, reload }) {
  const toast = useToast();
  const [draft, setDraft] = useDraft(settings, [
    "brand_name",
    "brand_tagline",
    "instagram",
    "support_email",
    "whatsapp",
    "announcement",
    "hero_eyebrow",
    "hero_title",
    "hero_sub",
    "hero_note",
    "accent_color",
    "ink_color",
    "bg_color",
    "faqs",
    "stats",
    "about",
    "refund_policy",
    "terms",
    "license_terms",
    "privacy",
  ]);

  async function save() {
    let patch = { ...draft };
    try {
      if (draft.faqs) JSON.parse(draft.faqs);
      if (draft.stats) JSON.parse(draft.stats);
    } catch {
      toast("FAQs and stats must be valid JSON.", "bad");
      return;
    }
    await saveSettings(patch, reload, toast);
  }

  return (
    <div className="stack-lg">
      <SectionCard
        title="Brand & hero"
        subtitle="The first screen people see. Change the words the moment you want a new angle."
        actions={
          <Button size="sm" onClick={save}>
            Save everything
          </Button>
        }
      >
        <div className="three-col">
          <Field label="Brand name">
            <Input value={draft.brand_name} onChange={(event) => setDraft({ ...draft, brand_name: event.target.value })} />
          </Field>
          <Field label="Instagram handle">
            <Input value={draft.instagram} onChange={(event) => setDraft({ ...draft, instagram: event.target.value })} />
          </Field>
          <Field label="Support email">
            <Input value={draft.support_email} onChange={(event) => setDraft({ ...draft, support_email: event.target.value })} />
          </Field>
        </div>
        <div className="two-col">
          <Field label="Tagline">
            <Input value={draft.brand_tagline} onChange={(event) => setDraft({ ...draft, brand_tagline: event.target.value })} />
          </Field>
          <Field label="WhatsApp (optional)">
            <Input value={draft.whatsapp} onChange={(event) => setDraft({ ...draft, whatsapp: event.target.value })} />
          </Field>
        </div>
        <Field label="Announcement strip" hint="Runs across the top of every page. Leave blank to hide.">
          <Input value={draft.announcement} onChange={(event) => setDraft({ ...draft, announcement: event.target.value })} />
        </Field>
        <div className="two-col">
          <Field label="Hero eyebrow">
            <Input value={draft.hero_eyebrow} onChange={(event) => setDraft({ ...draft, hero_eyebrow: event.target.value })} />
          </Field>
          <Field label="Hero headline" hint="The last few words are italicised automatically.">
            <Input value={draft.hero_title} onChange={(event) => setDraft({ ...draft, hero_title: event.target.value })} />
          </Field>
        </div>
        <Field label="Hero paragraph">
          <Textarea rows={3} value={draft.hero_sub} onChange={(event) => setDraft({ ...draft, hero_sub: event.target.value })} />
        </Field>
        <Field label="Hero note">
          <Input value={draft.hero_note} onChange={(event) => setDraft({ ...draft, hero_note: event.target.value })} />
        </Field>
        <div className="three-col">
          {[
            ["accent_color", "Accent colour"],
            ["ink_color", "Ink colour"],
            ["bg_color", "Background"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="color-row">
                <input
                  type="color"
                  value={draft[key] || "#000000"}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
                <Input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              </div>
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Proof & numbers"
        subtitle="Stats strip and FAQ. Plain JSON — edit the text, keep the shape."
        actions={
          <Button size="sm" variant="secondary" onClick={save}>
            Save
          </Button>
        }
      >
        <Field label="Stats strip" hint='[{"value":"12,400+","label":"readers"}]'>
          <Textarea rows={4} className="mono" value={draft.stats} onChange={(event) => setDraft({ ...draft, stats: event.target.value })} />
        </Field>
        <Field label="FAQs" hint='[{"q":"Question","a":"Answer"}]'>
          <Textarea rows={9} className="mono" value={draft.faqs} onChange={(event) => setDraft({ ...draft, faqs: event.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard
        title="Policies & about"
        subtitle="Shown on the policies, refund and footer pages."
        actions={
          <Button size="sm" variant="secondary" onClick={save}>
            Save
          </Button>
        }
      >
        <Field label="About">
          <Textarea rows={4} value={draft.about} onChange={(event) => setDraft({ ...draft, about: event.target.value })} />
        </Field>
        <Field label="Refund promise">
          <Textarea rows={4} value={draft.refund_policy} onChange={(event) => setDraft({ ...draft, refund_policy: event.target.value })} />
        </Field>
        <Field label="Personal licence">
          <Textarea rows={4} value={draft.license_terms} onChange={(event) => setDraft({ ...draft, license_terms: event.target.value })} />
        </Field>
        <Field label="Terms of use">
          <Textarea rows={4} value={draft.terms} onChange={(event) => setDraft({ ...draft, terms: event.target.value })} />
        </Field>
        <Field label="Privacy">
          <Textarea rows={4} value={draft.privacy} onChange={(event) => setDraft({ ...draft, privacy: event.target.value })} />
        </Field>
      </SectionCard>
    </div>
  );
}

/* -------------------------------- account -------------------------------- */

function Account({ admin, reload }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/password", { method: "POST", body: form });
      toast("Password updated");
      setForm({ current: "", next: "" });
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <SectionCard title="Admin account" subtitle="This email is the only account that can manage the store.">
        <div className="kv-admin">
          <span>Email</span>
          <strong>{admin.email}</strong>
        </div>
        <div className="kv-admin">
          <span>Session</span>
          <strong>Signed in · 7 day cookie</strong>
        </div>
        <p className="field-hint">
          Forgot the password? There is no reset email by design. You can clear the admins table in your D1
          database to trigger first-time setup again.
        </p>
      </SectionCard>

      <SectionCard title="Change password">
        <form onSubmit={submit} className="stack narrow-form">
          <Field label="Current password">
            <Input
              type="password"
              required
              value={form.current}
              onChange={(event) => setForm({ ...form, current: event.target.value })}
            />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input
              type="password"
              required
              value={form.next}
              onChange={(event) => setForm({ ...form, next: event.target.value })}
            />
          </Field>
          <Button type="submit" loading={busy} size="sm">
            Update password
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Data" subtitle="Your orders, exported as a spreadsheet-friendly file.">
        <a className="btn btn-secondary btn-sm" href="/api/admin/export/orders.csv">
          Download orders CSV ↓
        </a>
      </SectionCard>
    </div>
  );
}
