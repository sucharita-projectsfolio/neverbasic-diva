import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

/* --------------------------------- reveal -------------------------------- */

export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={cx("reveal", shown && "is-in", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* --------------------------------- toast --------------------------------- */

const ToastContext = createContext(() => {});

export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, type }]);
    window.setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={cx("toast", item.type)}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* -------------------------------- controls ------------------------------- */

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  as: Tag = "button",
  ...rest
}) {
  return (
    <Tag
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}
      disabled={Tag === "button" ? rest.disabled || loading : undefined}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={cx("field", className)}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Input(props) {
  return <input className={cx("input", props.className)} {...props} />;
}

export function Textarea(props) {
  return <textarea className={cx("input textarea", props.className)} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={cx("input select", props.className)} {...props}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" className="toggle-row" onClick={() => onChange(!checked)}>
      <span className={cx("toggle", checked && "on")} aria-hidden="true">
        <span />
      </span>
      <span>
        <span className="toggle-label">{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </span>
    </button>
  );
}

export function Stars({ value = 5, className = "" }) {
  return (
    <span className={cx("stars", className)} aria-label={`${value} out of 5`}>
      {"★".repeat(Math.round(value))}
      <span className="stars-dim">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export function Chip({ children, tone = "soft", className = "" }) {
  return <span className={cx("chip", `chip-${tone}`, className)}>{children}</span>;
}

export function StatusPill({ status }) {
  const map = {
    paid: "good",
    pending: "warn",
    failed: "bad",
    refunded: "bad",
    cancelled: "muted",
    open: "warn",
    answered: "good",
    closed: "muted",
    requested: "warn",
    approved: "good",
    rejected: "bad",
    material_sent: "good",
    active: "good",
    expired: "bad",
    revoked: "bad",
    new: "warn",
    contacted: "good",
    draft: "muted",
  };
  return <span className={cx("pill", `pill-${map[status] || "muted"}`)}>{String(status || "—").replace(/_/g, " ")}</span>;
}

/* --------------------------------- modal --------------------------------- */

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={cx("modal", wide && "modal-wide")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------- misc ---------------------------------- */

export function Cover({ ebook, className = "", lazy = true }) {
  const src = ebook?.cover || "";
  if (!src) {
    return (
      <div className={cx("cover cover-fallback", className)}>
        <span>{ebook?.title || "Neverbasic Diva"}</span>
      </div>
    );
  }
  return (
    <img
      className={cx("cover", className)}
      src={src}
      alt={ebook?.title || "Ebook cover"}
      loading={lazy ? "lazy" : "eager"}
    />
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="loading-block">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast("Copied");
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          toast("Copy failed — select manually", "bad");
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function Faq({ items }) {
  const [open, setOpen] = useState(0);
  if (!items || !items.length) return null;
  return (
    <div className="faq">
      {items.map((item, index) => (
        <div key={(item.q || "") + index} className={cx("faq-item", open === index && "open")}>
          <button type="button" className="faq-q" onClick={() => setOpen(open === index ? -1 : index)}>
            <span>{item.q}</span>
            <span className="faq-mark" aria-hidden="true">
              {open === index ? "–" : "+"}
            </span>
          </button>
          <div className="faq-a">{item.a}</div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-mark">✿</div>
      <h4>{title}</h4>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}
