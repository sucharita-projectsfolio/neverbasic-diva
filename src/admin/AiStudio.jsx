import React, { useMemo, useState } from "react";
import { api } from "../lib/api.jsx";
import { Button, Field, Input, Select, Textarea, Toggle, useToast } from "../ui.jsx";
import { readKit } from "../lib/sitekit.js";

const parse = (value, fallback) => {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
};

const splitModels = (value) =>
  String(value || "")
    .split(/[,\n]/)
    .map((model) => model.trim())
    .filter(Boolean);

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

const AI_SECTIONS = [
  ["title", "Title"],
  ["subtitle", "Subtitle"],
  ["description", "Description"],
  ["highlights", "What's inside"],
  ["sample", "Free sample"],
  ["pricing", "Price & MRP"],
  ["badge", "Badge"],
  ["category", "Category"],
  ["faq", "FAQ"],
  ["triggers", "Psych triggers"],
  ["seo", "SEO"],
  ["email", "Launch email"],
  ["tags", "Tags"],
];

export default function AiStudio({ data, reload }) {
  const toast = useToast();
  const settings = data.settings || {};
  const ai = data.ai || { providers: [], chain: [] };
  const raw = useMemo(() => parse(settings.ai_config, {}), [settings.ai_config]);
  const savedProviders = raw.providers || [];

  const provider = (id) => ai.providers.find((entry) => entry.id === id) || {};
  const initial = (id) => savedProviders.find((entry) => entry.id === id) || {};

  const [tone, setTone] = useState(settings.ai_tone || "");
  const [temperature, setTemperature] = useState(raw.temperature ?? 0.85);
  const [enabled, setEnabled] = useState(settings.ai_enabled !== "0");
  const [keys, setKeys] = useState({ groq: "", openrouter: "", custom: "" });
  const [models, setModels] = useState({
    groq: (provider("groq").models || []).join(", "),
    openrouter: (provider("openrouter").models || []).join(", "),
    custom: (provider("custom").models || []).join(", "),
  });
  const [custom, setCustom] = useState({
    label: initial("custom").label || "",
    baseUrl: initial("custom").baseUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [target, setTarget] = useState({ ebookId: data.ebooks[0]?.id || "", notes: "", fileKey: "", fileName: "", title: "" });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [sectionBusy, setSectionBusy] = useState("");
  const [applying, setApplying] = useState(false);
  const [storePrompt, setStorePrompt] = useState("");
  const [storeBusy, setStoreBusy] = useState(false);
  const [storePlan, setStorePlan] = useState(null);

  const ebook = data.ebooks.find((row) => row.id === target.ebookId) || null;

  async function saveConfig() {
    setSaving(true);
    try {
      const providers = [
        { id: "groq", enabled: true, apiKey: keys.groq || initial("groq").apiKey || "", models: splitModels(models.groq) },
        {
          id: "openrouter",
          enabled: true,
          apiKey: keys.openrouter || initial("openrouter").apiKey || "",
          models: splitModels(models.openrouter),
        },
      ];
      if (custom.baseUrl || initial("custom").baseUrl) {
        providers.push({
          id: "custom",
          enabled: true,
          label: custom.label || "Custom provider",
          baseUrl: custom.baseUrl || initial("custom").baseUrl || "",
          apiKey: keys.custom || initial("custom").apiKey || "",
          models: splitModels(models.custom),
        });
      }
      await api("/api/admin/settings", {
        method: "POST",
        body: {
          ai_config: JSON.stringify({ temperature: Number(temperature) || 0.85, providers }),
          ai_tone: tone,
          ai_enabled: enabled ? "1" : "0",
        },
      });
      toast("AI settings saved");
      setKeys({ groq: "", openrouter: "", custom: "" });
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await api("/api/admin/ai/test", { method: "POST" });
      setTestResult({ ok: true, ...response });
      toast(`${response.provider} answered with ${response.model}`);
    } catch (error) {
      setTestResult({ ok: false, error: error.message, attempts: error.data?.attempts || [] });
      toast(error.message, "bad");
    } finally {
      setTesting(false);
    }
  }

  async function uploadPdf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("kind", "file");
    form.append("file", file);
    try {
      const uploaded = await api("/api/admin/upload", { method: "POST", form });
      setTarget((current) => ({ ...current, fileKey: uploaded.key, fileName: uploaded.name, title: current.title || uploaded.name.replace(/\.pdf$/i, "") }));
      toast("PDF uploaded — ready to analyse");
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      event.target.value = "";
    }
  }

  async function analyze() {
    if (!target.ebookId && !target.fileKey && !target.notes) {
      toast("Pick an ebook, upload a PDF, or write a title + notes.", "bad");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const response = await api("/api/admin/ai/analyze", {
        method: "POST",
        body: {
          ebookId: target.ebookId || "",
          fileKey: target.fileKey || "",
          title: target.title || ebook?.title || "",
          notes: target.notes || "",
        },
      });
      setResult(response.result);
      setMeta({ ...response.result._meta, ...response });
      toast(`Written by ${response.result._meta.provider} · ${response.result.extractedChars} characters read`);
      if (target.ebookId) await reload();
    } catch (error) {
      toast(error.message, "bad");
      setMeta({ attempts: error.data?.attempts || [] });
    } finally {
      setAnalyzing(false);
    }
  }

  function patch(next) {
    setResult((current) => ({ ...current, ...next }));
  }

  async function regenerate(section) {
    setSectionBusy(section);
    try {
      const response = await api("/api/admin/ai/section", {
        method: "POST",
        body: { section, ebook: result, ebookId: target.ebookId, notes: target.notes },
      });
      patch(response.patch);
      toast(`Regenerated with ${response.meta.provider}`);
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setSectionBusy("");
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    try {
      const body = {
        id: target.ebookId || "",
        title: result.title,
        subtitle: result.subtitle,
        description: result.description,
        highlights: (result.highlights || []).join("\n"),
        category: result.category,
        pages: result.pages,
        price: result.price,
        mrp: result.mrp,
        badge: result.badge,
        sample: result.sample,
        tags: result.tags,
        ai_meta: result,
        file_key: target.fileKey || ebook?.file_key || "",
        file_name: target.fileName || ebook?.file_name || "",
        cover: ebook?.cover || "",
        status: ebook?.status || "active",
        featured: ebook?.featured || 0,
        sort: ebook?.sort || 0,
      };
      const saved = await api("/api/admin/ebooks", { method: "POST", body });
      toast(target.ebookId ? "Ebook updated with the new copy" : "Ebook created");
      setTarget((current) => ({ ...current, ebookId: saved.id, fileKey: "", fileName: "" }));
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setApplying(false);
    }
  }

  async function buildStore() {
    if (!storePrompt.trim()) {
      toast("Describe the store in one or two lines first.", "bad");
      return;
    }
    setStoreBusy(true);
    setStorePlan(null);
    try {
      const response = await api("/api/admin/ai/store", { method: "POST", body: { prompt: storePrompt } });
      setStorePlan(response);
      toast(`${response.blocks.length} sections written by ${response.meta.provider}`);
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      setStoreBusy(false);
    }
  }

  async function installStore() {
    if (!storePlan) return;
    if (!window.confirm("Replace the current home page sections and copy with this AI layout?")) return;
    try {
      const kit = readKit({ settings });
      const theme = { ...kit.theme, shape: storePlan.theme.shape, font: storePlan.theme.font, density: storePlan.theme.density };
      await api("/api/admin/settings", {
        method: "POST",
        body: {
          site_blocks: JSON.stringify(storePlan.blocks),
          site_content: JSON.stringify({ ...kit.content, ...storePlan.content }),
          site_theme: JSON.stringify(theme),
          ...(storePlan.theme.accent ? { accent_color: storePlan.theme.accent } : {}),
          ...(storePlan.theme.ink ? { ink_color: storePlan.theme.ink } : {}),
          ...(storePlan.theme.bg ? { bg_color: storePlan.theme.bg } : {}),
        },
      });
      toast("Layout installed — open the store to see it");
      setStorePlan(null);
      await reload();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  return (
    <div className="stack-lg">
      <Card
        title="Provider chain"
        hint="Groq runs first (free, fast, 120B). When its quota runs out the store falls through to OpenRouter's free models, then any custom endpoint. Nothing breaks when one key is exhausted."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={test} loading={testing}>
              Test chain
            </Button>
            <Button size="sm" onClick={saveConfig} loading={saving}>
              Save AI settings
            </Button>
          </>
        }
      >
        <div className="status-line">
          <span className={ai.providers.some((entry) => entry.hasKey) ? "dot good" : "dot warn"} />
          {ai.providers.some((entry) => entry.hasKey)
            ? `${ai.providers.filter((entry) => entry.hasKey).length} provider(s) ready`
            : "No key yet — paste one below, or set GROQ_API_KEY / OPENROUTER_API_KEY in Netlify"}
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label="AI features enabled" hint="Turn off to stop all AI calls instantly." />
        <div className="two-col">
          <Field label="Groq API key" hint={provider("groq").hasKey ? `Saved (${provider("groq").keySource}). Leave blank to keep it.` : "Free at console.groq.com → API keys"}>
            <Input type="password" value={keys.groq} onChange={(event) => setKeys({ ...keys, groq: event.target.value })} placeholder="gsk_…" autoComplete="off" />
          </Field>
          <Field label="OpenRouter API key" hint={provider("openrouter").hasKey ? `Saved (${provider("openrouter").keySource}). Leave blank to keep it.` : "Free at openrouter.ai/keys"}>
            <Input
              type="password"
              value={keys.openrouter}
              onChange={(event) => setKeys({ ...keys, openrouter: event.target.value })}
              placeholder="sk-or-v1-…"
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="two-col">
          <Field label="Groq models (in order)" hint="First available model wins. Comma separated.">
            <Textarea rows={2} value={models.groq} onChange={(event) => setModels({ ...models, groq: event.target.value })} />
          </Field>
          <Field label="OpenRouter models (in order)" hint="Free model ids, comma separated.">
            <Textarea rows={2} value={models.openrouter} onChange={(event) => setModels({ ...models, openrouter: event.target.value })} />
          </Field>
        </div>
        <div className="two-col">
          <Field label="Brand tone" hint="Used in every prompt.">
            <Textarea rows={2} value={tone} onChange={(event) => setTone(event.target.value)} />
          </Field>
          <Field label="Creativity (temperature)" hint="0.6 = safer, 1.0 = wilder. 0.85 is the sweet spot.">
            <Input type="number" min="0" max="1.2" step="0.05" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
          </Field>
        </div>
        <details className="admin-details">
          <summary>Optional fourth provider (any OpenAI-compatible API)</summary>
          <div className="three-col">
            <Field label="Label">
              <Input value={custom.label} onChange={(event) => setCustom({ ...custom, label: event.target.value })} placeholder="Cerebras" />
            </Field>
            <Field label="Base URL" hint="Must end in /v1">
              <Input value={custom.baseUrl} onChange={(event) => setCustom({ ...custom, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
            </Field>
            <Field label="Models">
              <Input value={models.custom} onChange={(event) => setModels({ ...models, custom: event.target.value })} placeholder="model-a, model-b" />
            </Field>
          </div>
          <Field label="API key">
            <Input type="password" value={keys.custom} onChange={(event) => setKeys({ ...keys, custom: event.target.value })} autoComplete="off" />
          </Field>
        </details>
        {testResult ? (
          <div className={`ai-result ${testResult.ok ? "good" : "bad"}`}>
            {testResult.ok ? `${testResult.provider} · ${testResult.model} → "${testResult.reply}"` : testResult.error}
          </div>
        ) : null}
        <p className="field-hint">
          Current chain: {ai.chain.length ? ai.chain.join("  ·  ") : "no provider with a key"}
        </p>
      </Card>

      <Card title="Ebook analyser" hint="Upload the PDF (or pick a published ebook). AI reads it and writes a complete, psychologically sharp product page — then you edit or regenerate any single section.">
        <div className="two-col">
          <Field label="Analyse an existing ebook">
            <Select value={target.ebookId} onChange={(event) => setTarget({ ...target, ebookId: event.target.value })}>
              <option value="">+ New ebook from PDF</option>
              {data.ebooks.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Or upload the PDF" hint="The file is stored privately and used as the delivery file too.">
            <div className="input-with-action">
              <input type="file" accept="application/pdf" onChange={uploadPdf} />
            </div>
          </Field>
        </div>
        {target.fileKey ? <p className="field-hint">✓ {target.fileName || "PDF ready"}</p> : null}
        <Field label="Author notes (optional)" hint="The angle, the reader, the promise, anything the PDF does not say.">
          <Textarea rows={3} value={target.notes} onChange={(event) => setTarget({ ...target, notes: event.target.value })} placeholder="This is for women in their 20s who underspend on themselves but overspend on everyone else…" />
        </Field>
        <Button onClick={analyze} loading={analyzing}>
          {analyzing ? "Reading & writing…" : "Analyse with AI"}
        </Button>
        {meta?.attempts?.length ? (
          <details className="admin-details">
            <summary>Provider attempts ({meta.attempts.length})</summary>
            <ul className="attempt-list">
              {meta.attempts.map((attempt, index) => (
                <li key={index}>
                  <strong>{attempt.provider}</strong> · {attempt.model} · {attempt.status || attempt.error} · {attempt.ms}ms
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      {result ? (
        <Card
          title="Generated product page"
          hint="Edit anything. Regenerate one block without losing the rest. Apply writes it to the ebook."
          actions={
            <Button size="sm" onClick={apply} loading={applying}>
              {target.ebookId ? "Apply to ebook" : "Create ebook"}
            </Button>
          }
        >
          <div className="ai-generated-grid">
            <div className="ai-field">
              <label>Title</label>
              <Input value={result.title || ""} onChange={(event) => patch({ title: event.target.value })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("title")} disabled={sectionBusy === "title"}>
                {sectionBusy === "title" ? "Regenerating…" : "↻ Regenerate"}
              </button>
            </div>
            <div className="ai-field">
              <label>Subtitle</label>
              <Input value={result.subtitle || ""} onChange={(event) => patch({ subtitle: event.target.value })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("subtitle")}>
                ↻ Regenerate
              </button>
            </div>
            <div className="ai-field full">
              <label>Description</label>
              <Textarea rows={8} value={result.description || ""} onChange={(event) => patch({ description: event.target.value })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("description")}>
                {sectionBusy === "description" ? "Regenerating…" : "↻ Regenerate"}
              </button>
            </div>
            <div className="ai-field full">
              <label>What's inside (one per line)</label>
              <Textarea
                rows={6}
                value={(result.highlights || []).join("\n")}
                onChange={(event) => patch({ highlights: event.target.value.split("\n").filter((line) => line.trim()) })}
              />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("highlights")}>
                ↻ Regenerate
              </button>
            </div>
            <div className="ai-field full">
              <label>Free sample</label>
              <Textarea rows={7} value={result.sample || ""} onChange={(event) => patch({ sample: event.target.value })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("sample")}>
                ↻ Regenerate
              </button>
            </div>
            <div className="ai-field">
              <label>Price</label>
              <Input type="number" value={result.price ?? 0} onChange={(event) => patch({ price: Number(event.target.value) || 0 })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("pricing")}>
                ↻ Regenerate
              </button>
            </div>
            <div className="ai-field">
              <label>MRP anchor</label>
              <Input type="number" value={result.mrp ?? 0} onChange={(event) => patch({ mrp: Number(event.target.value) || 0 })} />
            </div>
            <div className="ai-field">
              <label>Badge</label>
              <Input value={result.badge || ""} onChange={(event) => patch({ badge: event.target.value })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("badge")}>
                ↻
              </button>
            </div>
            <div className="ai-field">
              <label>Category</label>
              <Input value={result.category || ""} onChange={(event) => patch({ category: event.target.value })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("category")}>
                ↻
              </button>
            </div>
            <div className="ai-field">
              <label>Pages (estimate)</label>
              <Input type="number" value={result.pages ?? 0} onChange={(event) => patch({ pages: Number(event.target.value) || 0 })} />
            </div>
            <div className="ai-field">
              <label>Tags</label>
              <Input value={(result.tags || []).join(", ")} onChange={(event) => patch({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("tags")}>
                ↻
              </button>
            </div>
            <div className="ai-field full">
              <label>SEO title & description</label>
              <Input value={result.seoTitle || ""} onChange={(event) => patch({ seoTitle: event.target.value })} />
              <Textarea rows={2} value={result.seoDescription || ""} onChange={(event) => patch({ seoDescription: event.target.value })} />
            </div>
            <div className="ai-field full">
              <label>Psychological triggers used</label>
              <p className="ai-insight">
                {(result.triggers || []).join(" · ") || "—"}
                <br />
                <strong>Audience:</strong> {result.audience || "—"}
              </p>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("triggers")}>
                ↻ Regenerate insight
              </button>
            </div>
            <div className="ai-field full">
              <label>FAQ</label>
              <ul className="ai-faq">
                {(result.faq || []).map((item, index) => (
                  <li key={index}>
                    <strong>{item.q}</strong>
                    <span>{item.a}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => regenerate("faq")}>
                ↻ Regenerate FAQ
              </button>
            </div>
            <div className="ai-field full">
              <label>Launch email</label>
              <Input value={result.emailSubject || ""} onChange={(event) => patch({ emailSubject: event.target.value })} />
              <Textarea rows={4} value={result.emailBody || ""} onChange={(event) => patch({ emailBody: event.target.value })} />
            </div>
          </div>
          <div className="ai-actions">
            <Button variant="ghost" onClick={() => setResult(null)}>
              Discard
            </Button>
            <Button onClick={apply} loading={applying}>
              {target.ebookId ? "Apply to ebook" : "Create ebook"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card
        title="AI store builder"
        hint="Describe the store you want and AI rewrites the home page — sections, order, copy and look. Review it before installing."
        actions={
          <Button size="sm" onClick={buildStore} loading={storeBusy}>
            Generate layout
          </Button>
        }
      >
        <Textarea
          rows={3}
          value={storePrompt}
          onChange={(event) => setStorePrompt(event.target.value)}
          placeholder="A dark, expensive-feeling storefront in noir and gold. Speak to women who are tired of being polite about money. Lead with the library, then proof, then the resell offer."
        />
        {storePlan ? (
          <div className="ai-store-plan">
            <p className="field-hint">
              {storePlan.blocks.length} sections · {storePlan.theme.shape} / {storePlan.theme.font} / {storePlan.meta.provider}
            </p>
            <div className="ai-block-chips">
              {storePlan.blocks.map((block) => (
                <span key={block.id}>{block.type}</span>
              ))}
            </div>
            <div className="row-actions">
              <Button variant="ghost" onClick={() => setStorePlan(null)}>
                Discard
              </Button>
              <Button onClick={installStore}>Install this layout</Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
