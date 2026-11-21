import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.jsx";
import { Button, Field, Input, Select, Textarea, Toggle, useToast } from "../ui.jsx";
import {
  BLOCK_MAP,
  BLOCK_TYPES,
  DENSITIES,
  DEFAULT_BLOCKS,
  DEFAULT_CONTENT,
  DEFAULT_THEME,
  FONTS,
  SHAPES,
  THEME_PRESETS,
  blockLabel,
  newBlock,
  readKit,
} from "../lib/sitekit.js";

const CONTENT_GROUPS = [
  {
    title: "Navigation",
    hint: "The menu at the top of every page.",
    keys: ["nav_library", "nav_resell", "nav_support", "nav_order", "nav_cta"],
  },
  {
    title: "Footer",
    hint: "Column titles, links and fine print.",
    keys: [
      "footer_explore",
      "footer_care",
      "footer_payments",
      "footer_link_request",
      "footer_link_track",
      "footer_link_support",
      "footer_link_refund",
      "footer_link_policies",
      "footer_link_email",
      "footer_note_1",
      "footer_note_2",
      "footer_admin",
      "footer_rights",
      "footer_fine",
    ],
  },
  {
    title: "Library page",
    hint: "Shown at the top of /ebooks.",
    keys: ["shop_eyebrow", "shop_title", "shop_sub"],
  },
  {
    title: "Small labels",
    hint: "Loader text and the countdown label.",
    keys: ["loading", "offer_label"],
  },
];

const prettify = (key) =>
  key
    .split("_")
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

/* ------------------------------- field input ------------------------------ */

function ImageField({ value, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", "cover");
      form.append("file", file);
      const result = await api("/api/admin/upload", { method: "POST", form });
      onChange(result.url || "");
      toast("Image uploaded");
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="img-field">
      <div className="img-preview">{value ? <img src={value} alt="" /> : <span>no image</span>}</div>
      <div className="img-field-controls">
        <Input value={value || ""} placeholder="https://… or /covers/cover-1.jpg" onChange={(event) => onChange(event.target.value)} />
        <div className="img-field-actions">
          <label className="btn btn-ghost btn-sm">
            {busy ? "Uploading…" : "Upload"}
            <input type="file" accept="image/*" onChange={upload} hidden />
          </label>
          {value ? (
            <Button size="sm" variant="ghost" type="button" onClick={() => onChange("")}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ItemsField({ field, value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const blank = () => Object.fromEntries((field.itemFields || []).map((item) => [item.key, ""]));

  const update = (index, key, next) => {
    const copy = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: next } : row));
    onChange(copy);
  };

  return (
    <div className="items-editor">
      {rows.map((row, index) => (
        <div key={index} className="items-row">
          {(field.itemFields || []).map((item) =>
            item.type === "textarea" ? (
              <Textarea
                key={item.key}
                rows={2}
                placeholder={item.label}
                value={row[item.key] || ""}
                onChange={(event) => update(index, item.key, event.target.value)}
              />
            ) : (
              <Input
                key={item.key}
                placeholder={item.label}
                value={row[item.key] || ""}
                onChange={(event) => update(index, item.key, event.target.value)}
              />
            )
          )}
          <button type="button" className="icon-btn" aria-label="Remove row" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" type="button" onClick={() => onChange([...rows, blank()])}>
        + Add row
      </Button>
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.type === "textarea") {
    return (
      <Field label={field.label} hint={field.hint}>
        <Textarea rows={4} value={value || ""} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  if (field.type === "select") {
    return (
      <Field label={field.label} hint={field.hint}>
        <Select value={value || field.options[0][0]} onChange={(event) => onChange(event.target.value)}>
          {field.options.map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (field.type === "number") {
    return (
      <Field label={field.label} hint={field.hint}>
        <Input
          type="number"
          min={0}
          value={value ?? 0}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </Field>
    );
  }
  if (field.type === "toggle") {
    return (
      <div className="field">
        <Toggle checked={Boolean(value)} onChange={onChange} label={field.label} hint={field.hint} />
      </div>
    );
  }
  if (field.type === "image") {
    return (
      <Field label={field.label} hint={field.hint}>
        <ImageField value={value} onChange={onChange} />
      </Field>
    );
  }
  if (field.type === "items") {
    return (
      <Field label={field.label} hint={field.hint}>
        <ItemsField field={field} value={value} onChange={onChange} />
      </Field>
    );
  }
  if (field.type === "lines") {
    const text = Array.isArray(value) ? value.join("\n") : String(value || "");
    return (
      <Field label={field.label} hint="One per line.">
        <Textarea
          rows={4}
          value={text}
          onChange={(event) =>
            onChange(
              event.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            )
          }
        />
      </Field>
    );
  }
  return (
    <Field label={field.label} hint={field.hint}>
      <Input value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

/* -------------------------------- sections ------------------------------- */

function SectionsTab({ blocks, setBlocks, openId, setOpenId }) {
  const toast = useToast();
  const [palette, setPalette] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState("");

  async function rewrite(block) {
    setAiBusy(block.id);
    try {
      const result = await api("/api/admin/ai/rewrite", {
        method: "POST",
        body: { block, instruction: aiText },
      });
      setBlocks((list) => list.map((row) => (row.id === block.id ? { ...row, ...result.patch } : row)));
      toast(`Rewritten with ${result.meta.provider}`);
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setAiBusy("");
    }
  }

  const move = (index, delta) => {
    const next = [...blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  const update = (id, patch) => {
    setBlocks((list) => list.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  return (
    <div className="stack-lg">
      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3>Page sections</h3>
            <p>Order, hide, duplicate or rewrite any block. Changes go live on save.</p>
          </div>
          <div className="admin-card-actions">
            <Button size="sm" variant="secondary" type="button" onClick={() => setPalette(!palette)}>
              {palette ? "Close palette" : "+ Add section"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                if (window.confirm("Replace every section with the original layout?")) setBlocks(DEFAULT_BLOCKS.map((block) => ({ ...block })));
              }}
            >
              Reset layout
            </Button>
          </div>
        </div>

        {palette ? (
          <div className="palette-grid">
            {BLOCK_TYPES.map((spec) => (
              <button
                key={spec.type}
                type="button"
                className="palette-card"
                onClick={() => {
                  const block = newBlock(spec.type);
                  setBlocks((list) => [...list, block]);
                  setOpenId(block.id);
                  setPalette(false);
                }}
              >
                <span className="palette-glyph">{spec.glyph}</span>
                <strong>{spec.label}</strong>
                <small>{spec.hint}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="block-list">
          {blocks.map((block, index) => {
            const meta = blockLabel(block);
            const spec = BLOCK_MAP[block.type];
            const open = openId === block.id;
            return (
              <div key={block.id} className={`block-row${open ? " open" : ""}${block.hidden ? " hidden" : ""}`}>
                <div className="block-head">
                  <span className="block-glyph">{meta.glyph}</span>
                  <div className="block-titles">
                    <strong>
                      {meta.label}
                      {block.hidden ? <span className="block-hidden-tag">hidden</span> : null}
                    </strong>
                    <small>{meta.heading || spec?.hint}</small>
                  </div>
                  <div className="block-tools">
                    <button type="button" className="icon-btn" aria-label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Move down"
                      onClick={() => move(index, 1)}
                      disabled={index === blocks.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={block.hidden ? "Show" : "Hide"}
                      onClick={() => update(block.id, { hidden: !block.hidden })}
                    >
                      {block.hidden ? "◌" : "◉"}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Duplicate"
                      onClick={() =>
                        setBlocks((list) => [
                          ...list.slice(0, index + 1),
                          { ...JSON.parse(JSON.stringify(block)), id: `${block.type}-${Math.random().toString(36).slice(2, 8)}` },
                          ...list.slice(index + 1),
                        ])
                      }
                    >
                      ⧉
                    </button>
                    <button type="button" className="icon-btn" aria-label="Delete" onClick={() => setBlocks((list) => list.filter((row) => row.id !== block.id))}>
                      ×
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(open ? null : block.id)}>
                      {open ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>
                {open && spec ? (
                  <div className="block-body">
                    {spec.fields.map((field) => (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={block[field.key]}
                        onChange={(next) => update(block.id, { [field.key]: next })}
                      />
                    ))}
                    <div className="block-ai-row">
                      <Input
                        value={aiText}
                        onChange={(event) => setAiText(event.target.value)}
                        placeholder="AI instruction — e.g. make it shorter, more expensive, less salesy…"
                      />
                      <Button size="sm" variant="secondary" type="button" loading={aiBusy === block.id} onClick={() => rewrite(block)}>
                        ✷ AI rewrite
                      </Button>
                    </div>
                    <div className="block-body-foot">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => update(block.id, JSON.parse(JSON.stringify(spec.defaults)))}
                      >
                        Reset this section
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!blocks.length ? <p className="admin-muted">No sections yet. Add one from the palette.</p> : null}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------- copy --------------------------------- */

function CopyTab({ content, setContent }) {
  const [group, setGroup] = useState(CONTENT_GROUPS[0].title);
  const active = CONTENT_GROUPS.find((item) => item.title === group) || CONTENT_GROUPS[0];

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <h3>Every word on the site</h3>
          <p>Menu, footer, library page and the little labels. Section text lives under Sections.</p>
        </div>
      </div>
      <div className="studio-tabs slim">
        {CONTENT_GROUPS.map((item) => (
          <button key={item.title} type="button" className={group === item.title ? "active" : ""} onClick={() => setGroup(item.title)}>
            {item.title}
          </button>
        ))}
      </div>
      <p className="admin-muted">{active.hint}</p>
      <div className="stack">
        {active.keys.map((key) => (
          <Field key={key} label={prettify(key)}>
            <Input
              value={content[key] ?? ""}
              placeholder={DEFAULT_CONTENT[key] || ""}
              onChange={(event) => setContent({ ...content, [key]: event.target.value })}
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- themes -------------------------------- */

function ThemesTab({ theme, setTheme, colors, setColors }) {
  return (
    <div className="stack-lg">
      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3>Complete looks</h3>
            <p>One click sets the palette, shapes, type and spacing. Then tune anything in Look.</p>
          </div>
        </div>
        <div className="theme-preset-grid">
          {THEME_PRESETS.map((preset) => {
            const active = theme.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`theme-preset${active ? " active" : ""}`}
                onClick={() => {
                  setTheme({ ...theme, shape: preset.shape, font: preset.font, density: preset.density, preset: preset.id });
                  setColors({ accent_color: preset.accent, ink_color: preset.ink, bg_color: preset.bg });
                }}
              >
                <span
                  className="preset-swatch"
                  style={{ background: preset.bg, color: preset.ink, borderColor: preset.accent }}
                >
                  <em style={{ color: preset.accent }}>Aa</em>
                  <strong>Aa</strong>
                  <i style={{ background: preset.accent }} />
                  <i style={{ background: preset.ink, opacity: 0.35 }} />
                </span>
                <strong>{preset.label}</strong>
                <small>{preset.hint}</small>
                <span className="preset-colors">
                  <i style={{ background: preset.accent }} />
                  <i style={{ background: preset.ink }} />
                  <i style={{ background: preset.bg }} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------- look --------------------------------- */

function LookTab({ theme, setTheme, colors, setColors }) {
  return (
    <div className="stack-lg">
      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3>Shape pack</h3>
            <p>Corner language for cards, covers, inputs and buttons.</p>
          </div>
        </div>
        <div className="shape-grid">
          {SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              className={`shape-card${theme.shape === shape.id ? " active" : ""}`}
              onClick={() => setTheme({ ...theme, shape: shape.id })}
            >
              <span className="shape-sample" style={{ borderRadius: shape.md }} />
              <strong>{shape.label}</strong>
              <small>{shape.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3>Typography</h3>
            <p>Headline and body pairing, applied site-wide.</p>
          </div>
        </div>
        <div className="shape-grid">
          {FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              className={`shape-card${theme.font === font.id ? " active" : ""}`}
              onClick={() => setTheme({ ...theme, font: font.id })}
            >
              <span className="font-sample" style={{ fontFamily: font.display }}>
                Aa
              </span>
              <strong>{font.label}</strong>
              <small>{font.hint}</small>
            </button>
          ))}
        </div>
        <Field label="Spacing">
          <Select value={theme.density} onChange={(event) => setTheme({ ...theme, density: event.target.value })}>
            {DENSITIES.map((density) => (
              <option key={density.id} value={density.id}>
                {density.label} — {density.hint}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3>Colours & announcement</h3>
            <p>The top strip, its speed and an optional countdown.</p>
          </div>
        </div>
        <div className="three-col">
          {[
            ["accent_color", "Accent"],
            ["ink_color", "Ink"],
            ["bg_color", "Background"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="color-row">
                <input type="color" value={colors[key] || "#000000"} onChange={(event) => setColors({ ...colors, [key]: event.target.value })} />
                <Input value={colors[key] || ""} onChange={(event) => setColors({ ...colors, [key]: event.target.value })} />
              </div>
            </Field>
          ))}
        </div>
        <Toggle
          checked={theme.showAnnouncement !== false}
          onChange={(value) => setTheme({ ...theme, showAnnouncement: value })}
          label="Show the announcement strip"
          hint="Text itself is edited under Site content."
        />
        <div className="two-col">
          <Field label="Scroll speed">
            <Select value={theme.announcementSpeed || "normal"} onChange={(event) => setTheme({ ...theme, announcementSpeed: event.target.value })}>
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </Select>
          </Field>
          <Field label="Offer countdown ends" hint="Leave blank to hide the countdown.">
            <Input
              type="datetime-local"
              value={theme.offerEndsAt || ""}
              onChange={(event) => setTheme({ ...theme, offerEndsAt: event.target.value })}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------- advanced -------------------------------- */

function AdvancedTab({ theme, setTheme, blocks, content, colors }) {
  const toast = useToast();
  const [importText, setImportText] = useState("");

  function downloadLayout() {
    const blob = new Blob([JSON.stringify({ blocks, content, theme, colors }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "neverbasic-diva-layout.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importLayout() {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || typeof parsed !== "object") throw new Error("bad file");
      const confirmed = window.confirm("Replace the current sections, copy and look with this file?");
      if (!confirmed) return;
      const kit = { blocks: parsed.blocks, content: parsed.content, theme: parsed.theme, colors: parsed.colors };
      window.dispatchEvent(new CustomEvent("nbd:studio-import", { detail: kit }));
      toast("Layout loaded — review it, then publish");
      setImportText("");
    } catch {
      toast("That is not a valid layout file.", "bad");
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <h3>Advanced</h3>
          <p>Search preview, social image, your own CSS and layout backups.</p>
        </div>
      </div>
      <div className="two-col">
        <Field label="Layout backup" hint="Download every section, text overrides and look settings as a file.">
          <Button size="sm" variant="secondary" type="button" onClick={downloadLayout}>
            Download layout JSON
          </Button>
        </Field>
        <Field label="Restore a layout" hint="Paste a layout file you downloaded earlier.">
          <Textarea rows={4} className="mono" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"blocks":[…]}' />
          <Button size="sm" variant="ghost" type="button" onClick={importLayout} disabled={!importText.trim()}>
            Load layout
          </Button>
        </Field>
      </div>
      <Field label="Browser / search title" hint="Defaults to brand name + tagline.">
        <Input value={theme.seoTitle || ""} onChange={(event) => setTheme({ ...theme, seoTitle: event.target.value })} />
      </Field>
      <Field label="Meta description">
        <Textarea rows={3} value={theme.seoDescription || ""} onChange={(event) => setTheme({ ...theme, seoDescription: event.target.value })} />
      </Field>
      <Field label="Social share image">
        <ImageField value={theme.ogImage} onChange={(value) => setTheme({ ...theme, ogImage: value })} />
      </Field>
      <Field
        label="Custom CSS"
        hint="Advanced. Applied to the whole storefront — e.g. .hero-title { letter-spacing: -0.04em; }"
      >
        <Textarea
          rows={10}
          className="mono"
          value={theme.customCss || ""}
          onChange={(event) => setTheme({ ...theme, customCss: event.target.value })}
        />
      </Field>
    </section>
  );
}

/* ------------------------------ live preview ------------------------------ */

// Renders the real storefront in a frame beside the editor. Every keystroke is
// pushed into the frame as an unsaved draft, so nothing has to be published to
// see the result — and what you see is the actual page, not a mock-up.
function StudioPreview({ blocks, content, theme, colors, open, onToggle }) {
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const [device, setDevice] = useState("desktop");
  const [scale, setScale] = useState(0.4);
  const [stageHeight, setStageHeight] = useState(520);
  const [ready, setReady] = useState(false);

  const kit = useMemo(() => ({ blocks, content, theme, colors }), [blocks, content, theme, colors]);

  const send = useCallback(() => {
    const frame = frameRef.current;
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "nbd:studio-draft", kit }, window.location.origin);
  }, [kit]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "nbd:studio-ready") return;
      setReady(true);
      send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

  // Desktop previews render at 1280px and are scaled to fit the panel, so the
  // admin sees the real desktop layout instead of the tablet breakpoint.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !open) return undefined;
    const measure = () => {
      const width = stage.clientWidth || 420;
      if (device === "phone") {
        setScale(1);
        setStageHeight(Math.round(Math.min(720, Math.max(480, window.innerHeight * 0.72))));
      } else {
        setScale(Math.max(0.2, Math.min(1, width / 1280)));
        setStageHeight(Math.round(Math.min(780, Math.max(430, width * 1.3))));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return () => {};
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [device, open]);

  if (!open) {
    return (
      <aside className="studio-preview collapsed">
        <button type="button" className="studio-preview-tab" onClick={onToggle}>
          ▸ Live preview
        </button>
      </aside>
    );
  }

  return (
    <aside className="studio-preview">
      <div className="studio-preview-head">
        <div className="studio-preview-title">
          <strong>Live preview</strong>
          <small>{device === "phone" ? "Phone" : "Desktop"} · updates as you type</small>
        </div>
        <div className="studio-preview-tools">
          <button type="button" className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}>
            ▭
          </button>
          <button type="button" className={device === "phone" ? "on" : ""} onClick={() => setDevice("phone")}>
            ▯
          </button>
          <a href="/" target="_blank" rel="noreferrer" title="Open the storefront in a new tab">
            ↗
          </a>
          <button type="button" onClick={onToggle} title="Hide live preview">
            ×
          </button>
        </div>
      </div>
      <div className={`studio-preview-stage ${device}`} ref={stageRef} style={{ height: stageHeight }}>
        <iframe
          ref={frameRef}
          className={`studio-frame ${device}`}
          title="Store live preview"
          src="/"
          style={
            device === "desktop"
              ? { width: 1280, height: Math.round(stageHeight / scale), transform: `scale(${scale})` }
              : { width: 390, height: "100%" }
          }
          onLoad={() => {
            setReady(true);
            send();
          }}
        />
      </div>
      <p className="studio-preview-note">Scroll inside the frame. Nothing is public until you press Publish.</p>
    </aside>
  );
}

/* --------------------------------- studio -------------------------------- */

export default function Studio({ settings, reload }) {
  const toast = useToast();
  const base = useMemo(() => readKit({ settings }), [settings]);
  const [blocks, setBlocks] = useState(base.blocks);
  const [content, setContent] = useState(base.content);
  const [theme, setTheme] = useState({ ...DEFAULT_THEME, ...base.theme });
  const [colors, setColors] = useState({
    accent_color: settings.accent_color || "#B0665A",
    ink_color: settings.ink_color || "#241E1B",
    bg_color: settings.bg_color || "#FAF6F0",
  });
  const [tab, setTab] = useState("sections");
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState("");
  const [previewOpen, setPreviewOpen] = useState(true);

  // Re-sync after a save/reload, but never while the admin has unsaved edits.
  const currentSignature = useMemo(
    () => JSON.stringify({ blocks, content, theme, colors }),
    [blocks, content, theme, colors]
  );
  const baseSignature = useMemo(
    () => JSON.stringify({ blocks: base.blocks, content: base.content, theme: { ...DEFAULT_THEME, ...base.theme }, colors: {
      accent_color: settings.accent_color || "#B0665A",
      ink_color: settings.ink_color || "#241E1B",
      bg_color: settings.bg_color || "#FAF6F0",
    } }),
    [base, settings]
  );

  useEffect(() => {
    if (!signature) setSignature(baseSignature);
  }, [baseSignature, signature]);

  const dirty = currentSignature !== (signature || baseSignature);

  // Layout restore from Advanced arrives as an event so it reuses the same state.
  useEffect(() => {
    const onImport = (event) => {
      const detail = event.detail || {};
      if (Array.isArray(detail.blocks)) setBlocks(detail.blocks);
      if (detail.content && typeof detail.content === "object") setContent({ ...DEFAULT_CONTENT, ...detail.content });
      if (detail.theme && typeof detail.theme === "object") setTheme({ ...DEFAULT_THEME, ...detail.theme });
      if (detail.colors && typeof detail.colors === "object") setColors({ ...colors, ...detail.colors });
    };
    window.addEventListener("nbd:studio-import", onImport);
    return () => window.removeEventListener("nbd:studio-import", onImport);
  }, [colors]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "POST",
        body: {
          site_blocks: JSON.stringify(blocks),
          site_content: JSON.stringify(content),
          site_theme: JSON.stringify(theme),
          ...colors,
        },
      });
      toast("Published — your live site is updated");
      setSignature(currentSignature);
      await reload();
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      setSaving(false);
    }
  }, [blocks, content, theme, colors, currentSignature, reload, toast]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  return (
    <div className={`studio${previewOpen ? " has-preview" : ""}`}>
      <div className="studio-main">
        <div className="studio-bar">
        <div className="studio-tabs">
          {[
            ["sections", "Sections"],
            ["themes", "Themes"],
            ["copy", "Text & copy"],
            ["look", "Look & shapes"],
            ["advanced", "Advanced"],
          ].map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="studio-actions">
          <span className={`studio-state${dirty ? " dirty" : ""}`}>{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">
            Preview ↗
          </a>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
            Publish changes
          </Button>
        </div>
      </div>

      {tab === "sections" ? <SectionsTab blocks={blocks} setBlocks={setBlocks} openId={openId} setOpenId={setOpenId} /> : null}
      {tab === "themes" ? <ThemesTab theme={theme} setTheme={setTheme} colors={colors} setColors={setColors} /> : null}
      {tab === "copy" ? <CopyTab content={content} setContent={setContent} /> : null}
      {tab === "look" ? <LookTab theme={theme} setTheme={setTheme} colors={colors} setColors={setColors} /> : null}
        {tab === "advanced" ? (
          <AdvancedTab theme={theme} setTheme={setTheme} blocks={blocks} content={content} colors={colors} />
        ) : null}
      </div>

      <StudioPreview
        blocks={blocks}
        content={content}
        theme={theme}
        colors={colors}
        open={previewOpen}
        onToggle={() => setPreviewOpen((value) => !value)}
      />
    </div>
  );
}
