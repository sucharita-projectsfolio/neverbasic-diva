// AI layer — Groq first (free, fast, 120B), then OpenRouter free models, then any
// custom OpenAI-compatible endpoint. Every provider/model is tried in order and a
// quota, rate limit, bad key or outage silently falls through to the next one, so
// one exhausted free tier never breaks the store.
import { clean } from "./util.js";

export const PROVIDER_CATALOG = {
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKeys: ["GROQ_API_KEY", "GROQ_KEY"],
    // Each model carries its own free-tier quota, so the list doubles as the
    // quota fallback. The Llama models left Groq's free tier on 2026-08-16 and
    // now answer 403 for self-serve keys, so only production models are listed.
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-safeguard-20b"],
    jsonMode: true,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKeys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
    // OpenRouter retires free slugs without notice, so keep these to ids that
    // currently answer from https://openrouter.ai/api/v1/models.
    models: [
      "inclusionai/ling-3.2-flash:free",
      "particle-ai/particle-1:free",
      "google/gemma-4-26b-a4b-it:free",
      "baidu/ernie-5.5-flash-preview:free",
      "nvidia/nemotron-3.5-lightning:free",
      "liquid/lfm-3-1.7b:free",
    ],
    jsonMode: false,
  },
};

export class AiError extends Error {
  constructor(message, attempts = []) {
    super(message);
    this.name = "AiError";
    this.status = 502;
    this.attempts = attempts;
  }
}

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const asString = (value, max = 4000) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const asList = (value, max = 10, each = 400) =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item.trim().slice(0, each) : ""))
    .filter(Boolean)
    .slice(0, max);

/* ------------------------------ configuration ---------------------------- */

// Merges the admin-saved ai_config over provider defaults and environment keys.
// Admin keys win; env keys are the fallback so a Netlify deploy only needs vars.
export function readAiConfig(settings = {}, env = {}) {
  let saved = {};
  try {
    saved = JSON.parse(settings.ai_config || "{}") || {};
  } catch {
    saved = {};
  }
  const savedProviders = Array.isArray(saved.providers) ? saved.providers : [];
  const providers = [];

  for (const [id, meta] of Object.entries(PROVIDER_CATALOG)) {
    const user = savedProviders.find((entry) => entry && entry.id === id) || {};
    const envKey = meta.envKeys.map((key) => env[key]).find((value) => Boolean(value)) || "";
    const savedKey = asString(user.apiKey, 400);
    const apiKey = savedKey || envKey;
    // Saved models first, then any built-in model the admin has not listed.
    // Existing installs kept a copy of a model list that has since been
    // retired, and without this top-up every one of their calls fails while a
    // perfectly good model sits right there in the defaults.
    const savedModels = (Array.isArray(user.models) ? user.models : [])
      .map((model) => asString(model, 120))
      .filter(Boolean);
    const models = [...new Set([...savedModels, ...meta.models])].slice(0, 10);
    providers.push({
      id,
      label: meta.label,
      baseUrl: asString(user.baseUrl, 300) || meta.baseUrl,
      apiKey,
      keySource: savedKey ? "admin" : envKey ? "env" : "",
      models,
      enabled: user.enabled !== false,
      jsonMode: meta.jsonMode !== false,
    });
  }

  // Optional fourth provider: any OpenAI-compatible endpoint (Together, Cerebras,
  // Mistral, a local proxy…) configured entirely from the admin panel.
  const custom = savedProviders.find((entry) => entry && entry.id === "custom");
  if (custom && (custom.baseUrl || custom.apiKey)) {
    providers.push({
      id: "custom",
      label: asString(custom.label, 60) || "Custom provider",
      baseUrl: asString(custom.baseUrl, 300),
      apiKey: asString(custom.apiKey, 400),
      keySource: custom.apiKey ? "admin" : "",
      models: (Array.isArray(custom.models) ? custom.models : [])
        .map((model) => asString(model, 120))
        .filter(Boolean)
        .slice(0, 8),
      enabled: custom.enabled !== false,
      jsonMode: true,
    });
  }

  return {
    temperature: Math.min(1.4, Math.max(0, Number(saved.temperature) || 0.85)),
    providers: providers.filter((provider) => provider.enabled && provider.models.length),
    raw: saved,
  };
}

// Safe status for the admin panel: never returns a key, only whether one exists.
export function aiStatus(settings = {}, env = {}) {
  const config = readAiConfig(settings, env);
  return {
    enabled: settings.ai_enabled !== "0",
    temperature: config.temperature,
    envDetected: {
      groq: Boolean(env.GROQ_API_KEY || env.GROQ_KEY),
      openrouter: Boolean(env.OPENROUTER_API_KEY || env.OPENROUTER_KEY),
    },
    providers: [
      ...Object.entries(PROVIDER_CATALOG).map(([id, meta]) => {
        const saved = (config.raw.providers || []).find((entry) => entry && entry.id === id) || {};
        const resolved = config.providers.find((entry) => entry.id === id);
        return {
          id,
          label: meta.label,
          baseUrl: meta.baseUrl,
          models: resolved ? resolved.models : meta.models,
          enabled: saved.enabled !== false,
          hasKey: Boolean(resolved && resolved.apiKey),
          keySource: resolved ? resolved.keySource : "",
        };
      }),
      ...config.providers
        .filter((entry) => entry.id === "custom")
        .map((entry) => ({
          id: "custom",
          label: entry.label,
          baseUrl: entry.baseUrl,
          models: entry.models,
          enabled: true,
          hasKey: Boolean(entry.apiKey),
          keySource: entry.keySource,
        })),
    ],
    chain: config.providers.map((provider) => `${provider.label}: ${provider.models.join(" → ")}`),
  };
}

/* --------------------------------- core --------------------------------- */

// gpt-oss models are reasoning models: without a low effort setting they spend
// the entire max_tokens budget thinking and return an empty message.
const needsLowReasoning = (model) => /gpt-oss/i.test(String(model || ""));

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries every configured provider/model in order until one returns text.
 * Returns { text, provider, model, attempts }.
 */
export async function aiChat({
  settings = {},
  env = {},
  messages = [],
  json = false,
  temperature,
  maxTokens = 3000,
  timeout = 40000,
  budget = 90000,
} = {}) {
  if (settings.ai_enabled === "0") throw new AiError("AI is switched off in Admin → AI studio.");
  const config = readAiConfig(settings, env);
  const usable = config.providers.filter((provider) => provider.apiKey && provider.baseUrl);
  if (!usable.length) {
    throw new AiError(
      "No AI provider key yet. Paste your Groq and/or OpenRouter key in Admin → AI studio, or set GROQ_API_KEY / OPENROUTER_API_KEY in your hosting environment."
    );
  }

  // A visitor waiting on the chat widget should get an answer or an error in
  // seconds, not after every provider has timed out in turn.
  const stopAt = Date.now() + Math.max(5000, budget);
  const attempts = [];
  for (const provider of usable) {
    if (attempts.length && Date.now() >= stopAt) break;
    for (const model of provider.models) {
      if (attempts.length && Date.now() >= stopAt) break;
      const started = Date.now();
      const body = {
        model,
        messages,
        temperature: Math.min(1.4, Math.max(0, Number(temperature ?? config.temperature))),
        max_tokens: maxTokens,
      };
      if (json && provider.jsonMode) body.response_format = { type: "json_object" };
      if (needsLowReasoning(model)) body.reasoning_effort = "low";

      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
      };
      if (provider.id === "openrouter") {
        headers["HTTP-Referer"] = "https://neverbasicdiva.com";
        headers["X-Title"] = "Neverbasic Diva Studio";
      }

      let response;
      try {
        response = await fetchWithTimeout(
          `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`,
          { method: "POST", headers, body: JSON.stringify(body) },
          timeout
        );
      } catch (error) {
        attempts.push({
          provider: provider.label,
          model,
          status: 0,
          error: error && error.name === "AbortError" ? "timed out" : "network error",
          ms: Date.now() - started,
        });
        continue;
      }

      if (!response.ok) {
        let detail = "";
        try {
          detail = (await response.text()).slice(0, 400);
        } catch {
          detail = "";
        }
        // Some models reject response_format — retry once without it.
        if (json && body.response_format && response.status === 400 && /response_format|json/i.test(detail)) {
          const retryBody = { ...body };
          delete retryBody.response_format;
          try {
            const retry = await fetchWithTimeout(
              `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`,
              { method: "POST", headers, body: JSON.stringify(retryBody) },
              timeout
            );
            if (retry.ok) {
              const data = await retry.json();
              const text = extractText(data);
              if (text) {
                attempts.push({ provider: provider.label, model, status: 200, ms: Date.now() - started, retry: true });
                return { text, provider: provider.label, model, attempts };
              }
            }
          } catch {
            /* fall through to the next model */
          }
        }
        attempts.push({
          provider: provider.label,
          model,
          status: response.status,
          error: detail.replace(/\s+/g, " ").slice(0, 180) || response.statusText,
          ms: Date.now() - started,
        });
        // A bad key will fail for every model, move on to the next provider fast.
        if (response.status === 401 || response.status === 403) break;
        continue;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        attempts.push({ provider: provider.label, model, status: 200, error: "unreadable response", ms: Date.now() - started });
        continue;
      }
      let text = extractText(data);
      // A reasoning model that ran out of budget returns no content at all. Give
      // it a bigger allowance once instead of treating it as a dead model.
      if (!text && data?.choices?.[0]?.finish_reason === "length" && maxTokens < 4000) {
        try {
          const retry = await fetchWithTimeout(
            `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`,
            { method: "POST", headers, body: JSON.stringify({ ...body, max_tokens: Math.min(4000, Math.max(600, maxTokens * 8)) }) },
            timeout
          );
          if (retry.ok) text = extractText(await retry.json());
        } catch {
          /* fall through to the empty-response attempt below */
        }
      }
      if (!text) {
        attempts.push({ provider: provider.label, model, status: 200, error: "empty response", ms: Date.now() - started });
        continue;
      }
      attempts.push({ provider: provider.label, model, status: 200, ms: Date.now() - started });
      return { text, provider: provider.label, model, attempts };
    }
  }

  const last = attempts[attempts.length - 1];
  const hint = last && last.status === 429 ? "Every free quota is used up right now. Try again in a minute." : "All AI providers failed. Check your keys in Admin → AI studio.";
  const error = new AiError(`${hint}${last ? ` Last error: ${last.error || last.status}.` : ""}`, attempts);
  throw error;
}

function extractText(data) {
  try {
    const choice = data && data.choices && data.choices[0];
    if (!choice) return "";
    if (typeof choice.message?.content === "string") return choice.message.content.trim();
    if (Array.isArray(choice.message?.content)) {
      return choice.message.content
        .map((part) => (typeof part === "string" ? part : part?.text || ""))
        .join("")
        .trim();
    }
    if (typeof choice.text === "string") return choice.text.trim();
    return "";
  } catch {
    return "";
  }
}

export function parseJsonLoose(text) {
  if (!text) return null;
  const stripped = String(text)
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json)?/gi, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* find the outermost object or array */
  }
  const firstObject = stripped.indexOf("{");
  const firstArray = stripped.indexOf("[");
  const start = firstObject < 0 ? firstArray : firstArray < 0 ? firstObject : Math.min(firstObject, firstArray);
  if (start < 0) return null;
  const openChar = stripped[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(stripped.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/* --------------------------------- prompts -------------------------------- */

const systemPrompt = (tone) =>
  [
    "You are the copy chief for an independent micro-ebook store called Neverbasic Diva.",
    "You are a world-class direct-response copywriter and behavioural psychologist.",
    "You write like a sharp, warm friend who tells the truth — specific, human, confident, never cringe.",
    "Rules you never break:",
    "- No fake testimonials, fake credentials, fake scarcity numbers, income claims or guarantees.",
    "- No emoji spam. At most one subtle emoji in a whole piece, usually none.",
    "- Plain language. Short sentences. Concrete detail over adjectives.",
    "- Describe what the reader will be able to do, not how amazing the book is.",
    tone ? `- Brand tone for this store: ${tone}` : "",
    "Return only the requested JSON. No markdown fences, no commentary, no preamble.",
  ]
    .filter(Boolean)
    .join("\n");

const ANALYSIS_SHAPE = `{
  "title": "under 60 characters, magnetic, specific",
  "subtitle": "one line promise, under 110 characters",
  "hook": "one sentence that stops the scroll",
  "category": "Money | Mindset | Power | Relationships | Digital | Wellness",
  "badge": "2-3 words, e.g. Bestseller or New drop (empty string if none)",
  "pages": 34,
  "price": 99,
  "mrp": 499,
  "description": "150-260 words, 3-4 short paragraphs separated by \\n\\n. Opens with the reader's exact private frustration, names the cost of staying stuck, then promises the shift without hype. Weaves in real behavioural levers (loss aversion, identity, social proof of effort, specificity, future pacing) invisibly — never mention psychology jargon.",
  "highlights": ["6 outcome-led bullets, each under 90 characters, starting with a verb or a number"],
  "painPoints": ["4 things the reader secretly thinks, in their own words"],
  "triggers": ["5 psychological hooks used, named simply e.g. 'cost of waiting'"],
  "audience": "2 sentences: exactly who this is for and who it is not for",
  "faq": [{"q": "question", "a": "honest 1-2 sentence answer"}],
  "sample": "220-320 words of the actual opening of the ebook, in the author's voice, ending on a line that makes buying feel obvious",
  "seoTitle": "under 60 characters",
  "seoDescription": "under 155 characters",
  "emailSubject": "under 55 characters",
  "emailBody": "80-120 words launch email, one link placeholder {link}",
  "tags": ["8 short search tags"]
}`;

function normaliseAnalysis(raw, fallback = {}) {
  const faq = (Array.isArray(raw?.faq) ? raw.faq : [])
    .map((item) => ({ q: asString(item?.q, 200), a: asString(item?.a, 600) }))
    .filter((item) => item.q && item.a)
    .slice(0, 6);
  const price = clampInt(raw?.price, 0, 999999, clampInt(fallback.price, 0, 999999, 99));
  let mrp = clampInt(raw?.mrp, 0, 999999, clampInt(fallback.mrp, 0, 999999, price * 4));
  if (mrp < price) mrp = price;
  return {
    title: asString(raw?.title, 120) || asString(fallback.title, 120),
    subtitle: asString(raw?.subtitle, 220) || asString(fallback.subtitle, 220),
    hook: asString(raw?.hook, 300),
    category: asString(raw?.category, 40) || asString(fallback.category, 40) || "Mindset",
    badge: asString(raw?.badge, 40),
    pages: clampInt(raw?.pages, 0, 2000, clampInt(fallback.pages, 0, 2000, 30)),
    price,
    mrp,
    description: asString(raw?.description, 5000) || asString(fallback.description, 5000),
    highlights: asList(raw?.highlights, 8, 180),
    painPoints: asList(raw?.painPoints, 8, 300),
    triggers: asList(raw?.triggers, 8, 120),
    audience: asString(raw?.audience, 700),
    faq,
    sample: asString(raw?.sample, 4000),
    seoTitle: asString(raw?.seoTitle, 120),
    seoDescription: asString(raw?.seoDescription, 300),
    emailSubject: asString(raw?.emailSubject, 120),
    emailBody: asString(raw?.emailBody, 2000),
    tags: asList(raw?.tags, 12, 40),
  };
}

/**
 * Reads a PDF into rough text. Works for text-based PDFs (Flate-compressed or
 * plain). Scanned image PDFs return little text — the caller then writes from the
 * title/notes instead and says so.
 */
export async function pdfToText(buffer, cap = 40000) {
  if (!buffer) return { text: "", note: "empty file" };
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let latin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    latin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }

  const pieces = [];
  const streamRe = /stream\r?\n?([\s\S]*?)endstream/g;
  let match;
  let streams = 0;
  while ((match = streamRe.exec(latin)) && streams < 120) {
    streams += 1;
    const raw = match[1];
    const streamBytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) streamBytes[i] = raw.charCodeAt(i) & 0xff;
    let content = "";
    const head = latin.slice(Math.max(0, match.index - 500), match.index);
    const compressed = /FlateDecode/.test(head);
    if (compressed) content = await inflateText(streamBytes);
    if (!content && !compressed) content = raw;
    if (!content) content = await inflateText(streamBytes);
    if (content) pieces.push(extractTextOps(content));
  }

  const text = pieces
    .join("\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, cap);

  return {
    text,
    note: text.length < 400 ? "Very little selectable text found — this may be a scanned PDF, so the copy will lean on the title and your notes." : "",
  };
}

async function inflateText(bytes) {
  if (typeof DecompressionStream === "undefined") return "";
  const formats = ["deflate", "deflate-raw", "gzip"];
  for (const format of formats) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      const text = await new Response(stream).text();
      if (text) return text;
    } catch {
      /* try the next format */
    }
  }
  return "";
}

function pdfUnescape(value) {
  return String(value)
    .replace(/\\([nrtbf])/g, (_, ch) => ({ n: "\n", r: "\n", t: "\t", b: "", f: "" }[ch] ?? ""))
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8)))
    .replace(/\\(.)/g, "$1");
}

function extractTextOps(content) {
  const out = [];
  const tokenRe = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")|\[((?:[^\[\]]|\((?:\\.|[^\\()])*\))*)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj|\bT\*|\bTd|\bTD/g;
  let match;
  while ((match = tokenRe.exec(content))) {
    const token = match[0];
    if (/^(T\*|Td|TD)$/.test(token.trim())) {
      out.push("\n");
      continue;
    }
    if (match[2]) {
      // Hex-encoded string
      const hex = match[2].replace(/\s+/g, "");
      let str = "";
      for (let i = 0; i + 1 < hex.length; i += 2) str += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
      out.push(str, " ");
      continue;
    }
    if (match[1] !== undefined) {
      const inner = match[1];
      const parts = inner.match(/\((?:\\.|[^\\()])*\)/g) || [];
      for (const part of parts) out.push(pdfUnescape(part.slice(1, -1)), " ");
      out.push("\n");
      continue;
    }
    const literal = token.match(/^\((?:\\.|[^\\()])*\)/);
    if (literal) out.push(pdfUnescape(literal[0].slice(1, -1)), " ");
  }
  return out
    .join("")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F]/g, " ")
    .replace(/[ \t]{2,}/g, " ");
}

/* ------------------------------- operations ------------------------------ */

export async function analyzeEbook({
  settings = {},
  env = {},
  ebook = {},
  text = "",
  notes = "",
  tone = "",
  currency = "INR",
} = {}) {
  const excerpt = String(text || "").replace(/\s+/g, " ").slice(0, 26000);
  const title = clean(ebook.title || notes.split("\n")[0] || "Untitled ebook", 160);
  const user = [
    "Analyse this ebook and write the complete product page copy.",
    `Working title: ${title}`,
    ebook.subtitle ? `Existing subtitle: ${clean(ebook.subtitle, 200)}` : "",
    ebook.category ? `Category hint: ${clean(ebook.category, 40)}` : "",
    notes ? `Author notes / description to honour:\n${clean(notes, 4000)}` : "",
    `Store currency: ${currency}. Price should feel like an impulse buy (tea/coffee money), MRP a believable anchor.`,
    excerpt
      ? `Ebook text (truncated):\n"""\n${excerpt}\n"""`
      : "No readable text was extracted, so infer the strongest honest angle from the title and notes.",
    "Write to sell without lying. Every promise must be something a short practical ebook can actually deliver.",
    `Return exactly this JSON shape:\n${ANALYSIS_SHAPE}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await aiChat({
    settings,
    env,
    json: true,
    maxTokens: 3600,
    messages: [
      { role: "system", content: systemPrompt(tone || settings.ai_tone) },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose(result.text);
  if (!parsed || typeof parsed !== "object") {
    throw new AiError(`${result.provider} returned unreadable copy. Hit generate again — it usually lands cleanly on the second try.`, result.attempts);
  }
  return {
    ...normaliseAnalysis(parsed, ebook),
    _meta: { provider: result.provider, model: result.model, attempts: result.attempts },
  };
}

const SECTION_RULES = {
  title: {
    ask: "Write 5 title options then pick the single strongest as \"title\".",
    shape: '{"title":"…"}',
  },
  subtitle: {
    ask: "Write the one-line promise (subtitle) that makes the title land.",
    shape: '{"subtitle":"…"}',
  },
  description: {
    ask: "Write the long product description (150-260 words, 3-4 paragraphs separated by \\n\\n), opening with the reader's private frustration and closing with future pacing. No hype, no fake claims.",
    shape: '{"description":"…"}',
  },
  highlights: {
    ask: "Write 6 outcome-led 'what\\'s inside' bullets, each under 90 characters.",
    shape: '{"highlights":["…"]}',
  },
  badge: { ask: "Write a 2-3 word honest badge (or empty string).", shape: '{"badge":"…"}' },
  category: { ask: "Pick the best category from Money, Mindset, Power, Relationships, Digital, Wellness.", shape: '{"category":"…"}' },
  pricing: {
    ask: "Suggest an impulse price and a believable higher anchor MRP in integer units of the store currency. Low price must still feel deliberate, not cheap.",
    shape: '{"price":99,"mrp":499}',
  },
  faq: {
    ask: "Write 4 honest buyer questions with 1-2 sentence answers (delivery, refund, who it's for, format).",
    shape: '{"faq":[{"q":"…","a":"…"}]}',
  },
  sample: {
    ask: "Write the actual opening 220-320 words of the ebook in the author's voice. It should read like the book, not like marketing.",
    shape: '{"sample":"…"}',
  },
  seo: {
    ask: "Write a search title under 60 chars and meta description under 155 chars.",
    shape: '{"seoTitle":"…","seoDescription":"…"}',
  },
  triggers: {
    ask: "List the 4 private pains the reader feels, 5 behavioural triggers to use, and a 2-sentence audience line (who it is for / not for).",
    shape: '{"painPoints":["…"],"triggers":["…"],"audience":"…"}',
  },
  email: {
    ask: "Write a launch email: subject under 55 chars and 80-120 word body with the link placeholder {link}.",
    shape: '{"emailSubject":"…","emailBody":"…"}',
  },
  tags: { ask: "Write 8 short search tags.", shape: '{"tags":["…"]}' },
};

export async function generateSection({ settings = {}, env = {}, section, ebook = {}, notes = "", tone = "" } = {}) {
  const rule = SECTION_RULES[section];
  if (!rule) throw new AiError("Unknown section.");
  const context = [
    `Ebook: ${clean(ebook.title, 160) || "untitled"}`,
    ebook.subtitle ? `Subtitle: ${clean(ebook.subtitle, 220)}` : "",
    ebook.category ? `Category: ${clean(ebook.category, 40)}` : "",
    ebook.description ? `Current description: ${clean(ebook.description, 3000)}` : "",
    Array.isArray(ebook.highlights) && ebook.highlights.length ? `Current highlights: ${ebook.highlights.slice(0, 8).join(" | ")}` : "",
    notes ? `Author notes: ${clean(notes, 2000)}` : "",
    ebook.sample ? `Existing sample: ${clean(ebook.sample, 1500)}` : "",
    "Stay consistent with everything above. Improve, do not contradict.",
    rule.ask,
    `Return exactly this JSON shape: ${rule.shape}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await aiChat({
    settings,
    env,
    json: true,
    maxTokens: 1600,
    messages: [
      { role: "system", content: systemPrompt(tone || settings.ai_tone) },
      { role: "user", content: context },
    ],
  });
  const parsed = parseJsonLoose(result.text);
  if (!parsed || typeof parsed !== "object") throw new AiError("The model returned unreadable copy. Try regenerating.", result.attempts);
  const normalised = normaliseAnalysis(parsed, ebook);
  const keyMap = {
    title: ["title"],
    subtitle: ["subtitle"],
    description: ["description"],
    highlights: ["highlights"],
    badge: ["badge"],
    category: ["category"],
    pricing: ["price", "mrp"],
    faq: ["faq"],
    sample: ["sample"],
    seo: ["seoTitle", "seoDescription"],
    triggers: ["painPoints", "triggers", "audience"],
    email: ["emailSubject", "emailBody"],
    tags: ["tags"],
  };
  const patch = {};
  for (const key of keyMap[section]) patch[key] = normalised[key];
  return { patch, meta: { provider: result.provider, model: result.model, attempts: result.attempts } };
}

const BLOCK_TYPES = [
  "hero", "stats", "library", "value", "quote", "testimonials", "resell", "promise", "faq", "cta",
  "banner", "text", "gallery", "ticker", "countdown", "newsletter", "bundles", "journal", "split",
  "proof", "whatsapp",
];

export async function generateStore({ settings = {}, env = {}, prompt = "", catalog = [], tone = "" } = {}) {
  const books = (catalog || []).slice(0, 12).map((book) => `${book.title} — ${book.subtitle || ""} (${book.category || ""})`);
  const user = [
    "Design a complete storefront for this ebook shop.",
    `Owner brief: ${clean(prompt, 2000)}`,
    books.length ? `Catalogue:\n- ${books.join("\n- ")}` : "Catalogue: a small library of practical micro-ebooks.",
    `Allowed section types: ${BLOCK_TYPES.join(", ")}.`,
    "Use 7-10 sections, starting with hero, ending with cta. Only include a section type once unless it makes sense twice.",
    "Write real, specific copy — no lorem ipsum, no placeholder brackets except {brand}, {price}, {insta}, {count}.",
    'Return JSON: {"theme":{"shape":"soft|pill|sharp|arch|brutal","font":"editorial|modern|classic|mono","density":"airy|cozy|compact","accent":"#hex","ink":"#hex","bg":"#hex"},"content":{"nav_cta":"…","shop_title":"…","shop_sub":"…"},"blocks":[{"type":"hero","eyebrow":"…","title":"…","sub":"…","note":"…","primaryLabel":"…","primaryLink":"/ebooks","secondaryLabel":"…","secondaryLink":"/resell"},{"type":"stats","items":[{"value":"…","label":"…"}]}]}',
    "Blocks must only use fields that exist for that type; unknown fields are ignored. For library/bundles/journal/proof/faq/testimonials the store fills live data — you only write headings.",
    "Keep each text field under 400 characters. The description in a banner is a paragraph, not a novel.",
  ].join("\n\n");

  const result = await aiChat({
    settings,
    env,
    json: true,
    maxTokens: 4000,
    messages: [
      { role: "system", content: systemPrompt(tone || settings.ai_tone) },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose(result.text);
  if (!parsed || !Array.isArray(parsed.blocks)) throw new AiError("The model did not return a usable layout. Try again.", result.attempts);

  const blocks = [];
  for (const raw of parsed.blocks.slice(0, 14)) {
    const type = String(raw?.type || "");
    if (!BLOCK_TYPES.includes(type)) continue;
    const block = { type, id: `${type}-${Math.random().toString(36).slice(2, 8)}`, hidden: false };
    for (const [key, value] of Object.entries(raw)) {
      if (key === "type" || key === "id") continue;
      if (typeof value === "string") block[key] = value.slice(0, 800);
      else if (typeof value === "number" || typeof value === "boolean") block[key] = value;
      else if (Array.isArray(value)) {
        block[key] = value.slice(0, 8).map((item) => {
          if (typeof item === "string") return item.slice(0, 300);
          if (item && typeof item === "object") {
            const row = {};
            for (const [k2, v2] of Object.entries(item)) if (typeof v2 === "string") row[k2] = v2.slice(0, 400);
            return row;
          }
          return null;
        });
      }
    }
    blocks.push(block);
  }
  if (!blocks.length) throw new AiError("No valid sections came back. Try a more specific brief.", result.attempts);

  const theme = parsed.theme && typeof parsed.theme === "object" ? parsed.theme : {};
  const content = parsed.content && typeof parsed.content === "object" ? parsed.content : {};
  const safeContent = {};
  for (const [key, value] of Object.entries(content)) if (typeof value === "string") safeContent[key] = value.slice(0, 400);

  return {
    blocks,
    content: safeContent,
    theme: {
      shape: ["soft", "pill", "sharp", "arch", "brutal"].includes(theme.shape) ? theme.shape : "soft",
      font: ["editorial", "modern", "classic", "mono"].includes(theme.font) ? theme.font : "editorial",
      density: ["airy", "cozy", "compact"].includes(theme.density) ? theme.density : "cozy",
      accent: /^#[0-9a-f]{6}$/i.test(theme.accent || "") ? theme.accent : "",
      ink: /^#[0-9a-f]{6}$/i.test(theme.ink || "") ? theme.ink : "",
      bg: /^#[0-9a-f]{6}$/i.test(theme.bg || "") ? theme.bg : "",
    },
    meta: { provider: result.provider, model: result.model, attempts: result.attempts },
  };
}

export async function rewriteBlock({ settings = {}, env = {}, block = {}, instruction = "", tone = "" } = {}) {
  const type = String(block.type || "text");
  if (!BLOCK_TYPES.includes(type)) throw new AiError("Unknown section type.");
  const fields = Object.entries(block)
    .filter(([key]) => !["id", "type", "hidden"].includes(key))
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
  const user = [
    `Rewrite this ${type} section for an ebook storefront.`,
    instruction ? `Instruction: ${clean(instruction, 600)}` : "Instruction: make it sharper, more human and more specific without adding hype.",
    "Keep the same fields and the same JSON types. Do not invent numbers, testimonials or guarantees.",
    `Current section fields:\n${fields.slice(0, 6000)}`,
    "Return a JSON object with only the fields that should change.",
  ].join("\n\n");
  const result = await aiChat({
    settings,
    env,
    json: true,
    maxTokens: 1600,
    messages: [
      { role: "system", content: systemPrompt(tone || settings.ai_tone) },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose(result.text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AiError("No usable rewrite came back.", result.attempts);
  const patch = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (["id", "type", "hidden"].includes(key)) continue;
    if (typeof value === "string") patch[key] = value.slice(0, 900);
    else if (typeof value === "number" || typeof value === "boolean") patch[key] = value;
    else if (Array.isArray(value)) {
      patch[key] = value.slice(0, 8).map((item) => {
        if (typeof item === "string") return item.slice(0, 300);
        if (item && typeof item === "object") {
          const row = {};
          for (const [k2, v2] of Object.entries(item)) if (typeof v2 === "string") row[k2] = v2.slice(0, 400);
          return row;
        }
        return null;
      });
    }
  }
  return { patch, meta: { provider: result.provider, model: result.model, attempts: result.attempts } };
}

export async function assistantReply({ settings = {}, env = {}, messages = [], catalog = [] } = {}) {
  const history = (Array.isArray(messages) ? messages : [])
    .slice(-8)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: clean(message.content, 1200),
    }))
    .filter((message) => message.content);
  if (!history.length) throw new AiError("Ask a question first.");

  const books = (catalog || [])
    .slice(0, 24)
    .map((book) => `- ${book.title} (${book.category || "ebook"}, ${book.price} ${settings.currency || "INR"}) /ebooks/${book.slug} — ${clean(book.subtitle || book.description, 160)}`)
    .join("\n");

  const system = [
    "You are the shop assistant for Neverbasic Diva, an ebook store.",
    "Answer in at most 90 words. Warm, direct, no hype, never invent discounts, refunds or delivery promises beyond the facts below.",
    "Facts: payment unlocks the PDF instantly on the order page; prices are one-time; orders are looked up at /track with reference + email; support is at /support; resell licences exist only if enabled.",
    settings.resell_enabled === "1" ? `Resell licence: one-time ${settings.resell_price} for one year, page /resell.` : "Resell licences are currently closed.",
    books ? `Catalogue:\n${books}` : "",
    "If asked something you cannot know, say so and point to /support. Recommend one specific ebook with its link when relevant.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await aiChat({
    settings,
    env,
    json: false,
    maxTokens: 450,
    timeout: 12000,
    budget: 15000,
    messages: [{ role: "system", content: system }, ...history],
  });
  return { reply: result.text.slice(0, 1200), meta: { provider: result.provider, model: result.model } };
}

export async function testAi({ settings = {}, env = {} } = {}) {
  const result = await aiChat({
    settings,
    env,
    json: false,
    maxTokens: 400,
    messages: [
      { role: "system", content: "Reply with exactly: ready" },
      { role: "user", content: "ping" },
    ],
  });
  return { ok: true, provider: result.provider, model: result.model, reply: result.text.slice(0, 40), attempts: result.attempts };
}
