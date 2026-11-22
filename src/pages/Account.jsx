import React, { useEffect, useState } from "react";
import { api, formatPrice, currencyConfigFor, Link, prettyDate, prettyDateTime, useSite } from "../lib/api.jsx";
import { Button, Field, Input, Spinner, StatusPill, useToast } from "../ui.jsx";

const emptyForm = { name: "", email: "", password: "", phone: "" };

// Firebase returns terse codes; buyers need a sentence they can act on.
function firebaseError(code) {
  const map = {
    EMAIL_EXISTS: "That Firebase account already exists — sign in instead.",
    INVALID_PASSWORD: "Email or password is incorrect.",
    INVALID_LOGIN_CREDENTIALS: "Email or password is incorrect.",
    EMAIL_NOT_FOUND: "No Firebase account uses that email yet.",
    OPERATION_NOT_ALLOWED: "Email sign-in is switched off in the Firebase console. Enable Email/Password under Authentication → Sign-in method.",
    CONFIGURATION_NOT_FOUND: "Firebase Authentication is not set up for this project yet. Open Authentication in the Firebase console and click Get started.",
    API_KEY_INVALID: "The Firebase Web API key saved in admin is not valid.",
    USER_DISABLED: "That account is disabled in Firebase.",
    WEAK_PASSWORD: "Use at least 8 characters.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again in a few minutes.",
  };
  return map[code] || String(code || "Firebase sign-in failed").replace(/_/g, " ").toLowerCase();
}

async function firebaseReset(apiKey, email) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(firebaseError(data.error && data.error.message));
  return true;
}

async function firebaseExchange(apiKey, mode, email, password, name = "") {
  const action = mode === "signup" ? "signUp" : "signInWithPassword";
  // Firebase keeps the display name, and the server copies it onto the customer.
  const payload = { email, password, returnSecureToken: true };
  if (mode === "signup" && name) payload.displayName = name;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.idToken) {
    throw new Error(firebaseError((data.error && data.error.message) || "Firebase sign-in failed"));
  }
  return api("/api/account/firebase", { method: "POST", body: { idToken: data.idToken } });
}

export default function AccountPage() {
  const { site } = useSite();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState({ name: "", phone: "", country: "" });
  const [passwords, setPasswords] = useState({ current: "", next: "" });

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const result = await api("/api/account/session");
      setSession(result);
      if (result.customer) await loadData();
    } catch (err) {
      setSession({ accounts: true, customer: null });
      setError(err.message);
    }
  }

  async function loadData() {
    try {
      const result = await api("/api/account/data");
      setData(result);
      setProfile({ name: result.customer.name || "", phone: result.customer.phone || "", country: result.customer.country || "" });
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function submitAuth(event, override = "") {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { firebaseKey } = session || {};
      if (mode === "reset") {
        if (!firebaseKey) throw new Error("Password reset is not available yet. Message support and we will sort it out.");
        await firebaseReset(firebaseKey, form.email);
        setResetSent(true);
        return;
      }
      const result =
        override === "firebase" && firebaseKey
          ? await firebaseExchange(firebaseKey, mode, form.email, form.password, form.name)
          : await api(`/api/account/${mode === "signup" ? "signup" : "login"}`, {
              method: "POST",
              body: mode === "signup" ? form : { email: form.email, password: form.password },
            });
      setSession({ ...(session || {}), customer: result.customer });
      toast(mode === "signup" ? "Account created" : "Welcome back");
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const result = await api("/api/account/profile", { method: "POST", body: profile });
      setSession((current) => ({ ...current, customer: result.customer }));
      toast("Profile saved");
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    try {
      await api("/api/account/password", { method: "POST", body: passwords });
      setPasswords({ current: "", next: "" });
      toast("Password updated");
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function logout() {
    try {
      await api("/api/account/logout", { method: "POST" });
    } catch {
      /* already signed out */
    }
    setSession({ ...(session || {}), customer: null });
    setData(null);
    toast("Signed out");
  }

  if (!session) {
    return (
      <div className="page wrap narrow">
        <div className="boot">
          <Spinner />
          <p>Opening your account…</p>
        </div>
      </div>
    );
  }

  if (!session.customer) {
    return (
      <div className="page wrap narrow">
        <div className="panel account-auth">
          <span className="eyebrow">your account</span>
          <h1>
            Everything you bought, <em>in one place.</em>
          </h1>
          <p className="muted">
            Sign in with the email you used at checkout. Your ebooks, receipts, requests and support
            threads stay here — no order-reference hunting.
          </p>
          <div className="account-tabs">
            <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>
              Sign in
            </button>
            <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>
              Create account
            </button>
          </div>
          <form onSubmit={submitAuth} className="stack">
            {mode === "signup" ? (
              <div className="two-col">
                <Field label="Your name">
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                </Field>
                <Field label="Phone / WhatsApp">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
                </Field>
              </div>
            ) : null}
            <Field label="Email">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </Field>
            {mode !== "reset" ? (
              <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : ""}>
                <Input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>
            ) : null}
            {resetSent ? (
              <p className="form-note">
                Reset link sent to <strong>{form.email}</strong>. Open it, set a new password, then sign in here.
              </p>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" size="lg" loading={busy} className="btn-block">
              {mode === "reset" ? "Send reset link" : mode === "signup" ? "Create my account" : "Sign in"}
            </Button>
            {session.firebaseKey && mode !== "reset" ? (
              <Button
                type="button"
                variant="secondary"
                className="btn-block"
                loading={busy}
                onClick={(event) => submitAuth(event, "firebase")}
              >
                Continue with Firebase
              </Button>
            ) : null}
          </form>
          <p className="field-hint">
            Bought as a guest? Create an account with the same email — every past order attaches itself
            automatically.{" "}
            {session.firebaseKey ? (
              mode === "reset" ? (
                <button type="button" className="link-btn" onClick={() => { setMode("login"); setResetSent(false); }}>
                  Back to sign in
                </button>
              ) : (
                <button type="button" className="link-btn" onClick={() => { setMode("reset"); setError(""); }}>
                  Forgot your password?
                </button>
              )
            ) : (
              <>
                Forgot your password? <Link to="/support">Message support</Link>.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const customer = data?.customer || session.customer;
  const summary = data?.summary || { orders: 0, paid: 0, spent: 0, downloads: 0 };

  return (
    <div className="page wrap account-page">
      <header className="page-head account-head">
        <div>
          <span className="eyebrow">your account</span>
          <h1>
            Hi, <em>{String(customer.name || customer.email).split(" ")[0]}.</em>
          </h1>
          <p className="muted">{customer.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </header>

      <div className="account-stats">
        <div>
          <strong>{summary.paid}</strong>
          <span>ebooks owned</span>
        </div>
        <div>
          <strong>{summary.orders}</strong>
          <span>orders</span>
        </div>
        <div>
          <strong>{formatPrice(summary.spent, { currency: "INR", symbol: "₹", rate: 1 })}</strong>
          <span>spent (INR base)</span>
        </div>
        <div>
          <strong>{summary.downloads}</strong>
          <span>downloads</span>
        </div>
      </div>

      <div className="account-grid">
        <section className="panel account-orders">
          <h3>Your library</h3>
          {data?.orders?.length ? (
            <div className="download-list">
              {data.orders.map((order) => (
                <div key={order.ref} className="account-order">
                  <div className="account-order-head">
                    <div>
                      <strong>{order.title}</strong>
                      <small>
                        {order.ref} · {prettyDate(order.created_at)} ·{" "}
                        {formatPrice(order.amountCharged, currencyConfigFor(order.currency, site?.pricing))}
                      </small>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  {order.status === "paid" ? (
                    <div className="account-order-links">
                      {order.items.length ? (
                        order.items.map((item) => (
                          <a key={item.id} className="btn btn-primary btn-sm" href={item.downloadUrl}>
                            Download {item.title} ↓
                          </a>
                        ))
                      ) : (
                        <a className="btn btn-primary btn-sm" href={order.downloadUrl}>
                          Download PDF ↓
                        </a>
                      )}
                      {order.receiptUrl ? (
                        <a className="btn btn-ghost btn-sm" href={order.receiptUrl}>
                          Receipt
                        </a>
                      ) : null}
                      <Link className="btn btn-ghost btn-sm" to={`/order/${order.ref}`}>
                        Order page
                      </Link>
                    </div>
                  ) : (
                    <div className="account-order-links">
                      <Link className="btn btn-secondary btn-sm" to={`/order/${order.ref}`}>
                        Finish payment
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              Nothing here yet. <Link to="/ebooks">Browse the library</Link> — everything you buy lands here.
            </p>
          )}
        </section>

        <section className="panel">
          <h3>Profile</h3>
          <form onSubmit={saveProfile} className="stack">
            <Field label="Name">
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </Field>
            <Field label="Phone / WhatsApp">
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Field label="Country" hint="Two-letter code, e.g. IN or US — used for pricing and receipts.">
              <Input
                value={profile.country}
                maxLength={2}
                onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase() })}
              />
            </Field>
            <Button type="submit" size="sm">
              Save profile
            </Button>
          </form>

          <h3 className="account-sub">Password</h3>
          <form onSubmit={savePassword} className="stack">
            {customer.passwordSet ? (
              <Field label="Current password">
                <Input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  autoComplete="current-password"
                />
              </Field>
            ) : null}
            <Field label="New password" hint="At least 8 characters.">
              <Input
                required
                type="password"
                value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit" size="sm" variant="secondary">
              Update password
            </Button>
          </form>
        </section>
      </div>

      <div className="account-grid">
        <section className="panel">
          <h3>Support threads</h3>
          {data?.tickets?.length ? (
            <ul className="account-list account-tickets">
              {data.tickets.map((ticket) => (
                <li key={ticket.ref}>
                  <div>
                    <strong>{ticket.subject}</strong>
                    <small>
                      {ticket.ref} · {prettyDateTime(ticket.updated_at || ticket.created_at)}
                    </small>
                    {ticket.messages?.length ? (
                      <details className="account-thread">
                        <summary>{ticket.messages.length} message{ticket.messages.length === 1 ? "" : "s"} · read the thread</summary>
                        {ticket.messages.map((message, index) => (
                          <div key={`${ticket.ref}-${index}`} className={`account-message ${message.author === "admin" ? "from-team" : "from-you"}`}>
                            <strong>{message.author === "admin" ? "Neverbasic Diva" : "You"}</strong>
                            <p>{message.body}</p>
                            <small>{prettyDateTime(message.created_at)}</small>
                          </div>
                        ))}
                      </details>
                    ) : null}
                    <Link
                      className="account-thread-link"
                      to={`/support?ticket=${encodeURIComponent(ticket.ref)}&email=${encodeURIComponent(data?.customer?.email || "")}`}
                    >
                      Reply in the thread →
                    </Link>
                  </div>
                  <StatusPill status={ticket.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No support threads yet.</p>
          )}
        </section>
        <section className="panel">
          <h3>Requests &amp; refunds</h3>
          {data?.requests?.length ? (
            <ul className="account-list">
              {data.requests.map((request) => (
                <li key={request.id}>
                  <div>
                    <strong>{request.topic}</strong>
                    <small>
                      {prettyDate(request.created_at)} · {request.status}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {data?.refunds?.length ? (
            <ul className="account-list">
              {data.refunds.map((refund) => (
                <li key={refund.ref}>
                  <div>
                    <strong>{refund.order_ref}</strong>
                    <small>{prettyDate(refund.created_at)}</small>
                  </div>
                  <StatusPill status={refund.status} />
                </li>
              ))}
            </ul>
          ) : null}
          {!data?.requests?.length && !data?.refunds?.length ? (
            <p className="muted">
              Nothing open. <Link to="/request">Request an ebook</Link> any time.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
