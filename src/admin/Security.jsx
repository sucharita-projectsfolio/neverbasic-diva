import React, { useCallback, useEffect, useState } from "react";
import { api, prettyDateTime } from "../lib/api.jsx";
import { Button, useToast } from "../ui.jsx";

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

export default function Security({ data, reload }) {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api("/api/admin/security/sessions");
      setSessions(result.sessions || []);
    } catch (error) {
      toast(error.message, "bad");
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function revokeOthers() {
    if (!window.confirm("Sign out every other device?")) return;
    setBusy(true);
    try {
      await api("/api/admin/security/revoke-others", { method: "POST" });
      toast("Every other session is signed out");
      await load();
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <Card
        title="Active admin sessions"
        hint="One session per signed-in device. Revoke everything else after using a shared computer."
        actions={
          <Button size="sm" variant="secondary" onClick={revokeOthers} loading={busy}>
            Sign out other devices
          </Button>
        }
      >
        <ul className="session-list">
          {sessions.map((session) => (
            <li key={session.id} className={session.current ? "current" : ""}>
              <div>
                <strong>…{session.id}</strong>
                <small>
                  started {prettyDateTime(session.created_at)} · expires {prettyDateTime(session.expires_at)}
                </small>
              </div>
              <span className={`pill pill-${session.current ? "good" : session.expired ? "bad" : "muted"}`}>
                {session.current ? "this device" : session.expired ? "expired" : "active"}
              </span>
            </li>
          ))}
          {!sessions.length ? <li className="admin-muted">No sessions found.</li> : null}
        </ul>
      </Card>

      <Card
        title="Backup & restore"
        hint="Daily automatic snapshots plus a full download with every setting, ebook, order and uploaded cover image. Restore is merge-only — it never deletes newer content."
        actions={
          <a className="btn btn-secondary btn-sm" href="/api/admin/backup/export">
            Download full backup
          </a>
        }
      >
        <p className="admin-muted">
          Manage snapshots and restore a file from Admin → Growth → Backup & safety. The export contains private keys
          and buyer emails, so treat it like a password. It is served only to a signed-in admin and never cached.
        </p>
      </Card>

      <Card title="Audit log" hint="The last 120 admin actions — logins, settings changes, deletions and backups.">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {(data.audit || []).map((row) => (
                <tr key={row.id}>
                  <td>{prettyDateTime(row.created_at)}</td>
                  <td>{row.actor}</td>
                  <td>
                    <strong>{String(row.action).replace(/_/g, " ")}</strong>
                  </td>
                  <td className="clamp-cell">{row.detail}</td>
                  <td>{row.ip || "—"}</td>
                </tr>
              ))}
              {!(data.audit || []).length ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Nothing logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="What is already protecting the store" hint="On by default, no configuration needed.">
        <ul className="security-list">
          <li>
            <strong>Admin sessions</strong> are HTTP-only, SameSite cookies; passwords use PBKDF2 with 120k
            iterations and are never stored in plain text.
          </li>
          <li>
            <strong>CSRF guard</strong> rejects any state-changing request that does not come from your own
            domain. Payment callbacks are exempt and verified by gateway signature instead.
          </li>
          <li>
            <strong>Rate limits</strong> on login attempts, coupons, reviews, newsletter signups and the AI
            assistant stop scripted abuse.
          </li>
          <li>
            <strong>Content Security Policy</strong> plus nosniff, referrer and permissions headers block
            injected scripts and clickjacking surfaces.
          </li>
          <li>
            <strong>Payments</strong> are signature-verified (PayU reverse hash, Razorpay HMAC, Stripe webhook)
            and the paid amount is checked before a file unlocks.
          </li>
          <li>
            <strong>Uploads</strong> are limited to PDF or real image types and stored privately; download
            tokens are random and only issued to paid orders.
          </li>
        </ul>
      </Card>
    </div>
  );
}
