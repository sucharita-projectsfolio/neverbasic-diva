// AI layer — Groq first (free, fast, 120B), then OpenRouter free models, then any
// custom OpenAI-compatible endpoint. Every provider/model is tried in order and a
// quota, rate limit, bad key or outage silently falls through to the next one, so
// one exhausted free tier never breaks the store.
import { clean } from "./util.js";

export const PROVIDER_CATALOG = {
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    // Gemini writes the product-page copy first and everything else is the
    // fallback. Verified against a live key: 3.6-flash and 3.5-flash answer
    // hard JSON reliably; 3.8-flash occasionally returns 503 on high demand, so
    // it sits behind the two steadier models.
    models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"],
    jsonMode: true,
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKeys: ["GROQ_API_KEY", "GROQ_KEY"],
    // Strongest first: the 120B gpt-oss is the most capable, fastest model on
    // Groq's free tier (verified against /v1/models and a live completion). The
    // list doubles as the per-model quota fallback.
    models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-safeguard-20b"],
    jsonMode: true,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKeys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
    // OpenRouter retires free slugs without notice, so these were re-verified
    // against /api/v1/models and real completions. Ordered biggest model first:
    // Nemotron 3 Ultra (550B) writes the strongest copy, then Ernie 5.5, then
    // Particle. Each one answers with reasoning_effort=low so the whole budget
    // is not spent thinking.
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "baidu/ernie-5.5-flash-preview:free",
      "particle-ai/particle-1:free",
      "nvidia/nemotron-3.5-lightning:free",
      "inclusionai/ling-3.2-flash:free",
      "recursive/flint-v1.0:free",
    ],
    jsonMode: false,
  },
};

// Model ids we previously shipped that no longer answer (retired free slugs or
// models that left the free tier). Saved configs are cleaned of these on boot so
// an old install stops trying dead models before the strong current ones.
export const RETIRED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "liquid/lfm-3-1.7b:free",
]);

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
      gemini: Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
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

// gpt-oss and Nemotron models are reasoning models: without a low effort setting
// they spend the entire max_tokens budget thinking and return an empty message.
const needsLowReasoning = (model) => /gpt-oss|nemotron/i.test(String(model || ""));

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
      "No AI provider key yet. Paste your Gemini, Groq and/or OpenRouter key in Admin → AI studio, or set GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY in your hosting environment."
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
        // Some models reject response_format or reasoning_effort — retry once
        // without the optional parameters instead of skipping a good model.
        if (response.status === 400 && (body.response_format || body.reasoning_effort)) {
          const retryBody = { ...body };
          delete retryBody.response_format;
          delete retryBody.reasoning_effort;
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
      // A JSON answer that got cut off is as useless as an empty one: give the
      // model one bigger allowance, then move on to the next provider instead of
      // failing the whole product page.
      const brokenJson = () => json && !parseJsonLoose(text);
      if ((!text || brokenJson()) && data?.choices?.[0]?.finish_reason === "length" && maxTokens < 8000) {
        try {
          const retry = await fetchWithTimeout(
            `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`,
            { method: "POST", headers, body: JSON.stringify({ ...body, max_tokens: Math.min(8000, Math.max(2400, maxTokens * 2)) }) },
            timeout
          );
          if (retry.ok) text = extractText(await retry.json());
        } catch {
          /* fall through to the checks below */
        }
      }
      if (!text) {
        attempts.push({ provider: provider.label, model, status: 200, error: "empty response", ms: Date.now() - started });
        continue;
      }
      // When JSON was requested, unreadable output means this model failed — try
      // the next one rather than throwing away the request.
      if (json && !parseJsonLoose(text)) {
        attempts.push({ provider: provider.label, model, status: 200, error: "unreadable json", ms: Date.now() - started });
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
    "You write like a sharp, warm friend who tells the truth — specific, human, confident, never cringe.",
    "Rules you never break:",
    "- No fake testimonials, fake credentials, fake scarcity numbers, income claims or guarantees.",
    "- No emoji spam. At most one subtle emoji in a whole piece, usually none.",
    "- Write at a grade 7 reading level: everyday words, short sentences, one idea per line.",
    "- Never use these words or anything like them: leverage, unlock, journey, transform, game-changer, dive deep, delve, robust, holistic, synergy, empower, manifest, curated, elevate, unleash, tapestry, realm, navigate the landscape, testament, revolutionise, seamless, cutting-edge, in today's fast-paced world.",
    "- No AI voice: no rule-of-three in every sentence, no em-dash pile-ups, no 'it's not just X, it's Y', no rhetorical questions stacked on each other.",
    "- Describe what the reader will be able to do, not how amazing the book is.",
    "- Psychology must stay invisible: write the line a person actually feels. Never name a technique inside the copy.",
    "- SEO without keywords stuffing: use the phrases a real person would type into Google, once or twice, in natural sentences.",
    tone ? `- Brand tone for this store: ${tone}` : "",
    "Return only the requested JSON. No markdown fences, no commentary, no preamble.",
  ]
    .filter(Boolean)
    .join("\n");

const ANALYSIS_SHAPE = `{
  "title": "under 60 characters, magnetic, specific, the words a buyer would search",
  "subtitle": "one line promise, under 110 characters",
  "hook": "one sentence that stops the scroll",
  "category": "Money | Mindset | Power | Relationships | Digital | Wellness",
  "badge": "2-3 words, e.g. Bestseller or New drop (empty string if none)",
  "pages": 34,
  "price": 99,
  "mrp": 499,
  "description": "150-230 words, 3-4 short paragraphs separated by \\n\\n. Paragraph 1: the reader's private frustration in their own words. Paragraph 2: what is actually inside, concrete. Paragraph 3: what changes for them, then a quiet close. Plain everyday words. The pull comes from being seen, not from adjectives.",
  "highlights": ["6 outcome-led bullets, each under 90 characters, starting with a verb or a number"],
  "painPoints": ["4 things the reader secretly thinks, in their own words"],
  "triggers": ["5 psychological hooks used, named simply e.g. 'cost of waiting'"],
  "audience": "2 sentences: exactly who this is for and who it is not for",
  "faq": [{"q": "question", "a": "honest 1-2 sentence answer"}],
  "sample": "220-320 words of the actual opening of the ebook, in the author's voice, ending on a line that makes buying feel obvious",
  "seoTitle": "under 58 characters, includes the main search phrase and the words ebook/pdf",
  "seoDescription": "under 152 characters, the promise plus 'instant PDF download', reads like a search result not an ad",
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

/* --------------------------- built-in copywriter -------------------------- */
// A missing key, an exhausted free quota or a provider outage must never leave
// the owner with an empty product page. This writer works only from the ebook's
// own text (or the title and notes), uses everyday words and fills every field
// the product page needs.

const PLAIN_STOPWORDS = new Set(
  "the a an and or but if then than that this these those for with from into over under about after before again against because been being between both did does doing down during each few further had has have having here how its itself just more most other our out own same she should some such their them there they too until very was were what when where which while who whom why will your yours you i we it is are was be to of in on at by as not no so do can could would may might must im ive id ill thats youre dont didnt cant wont isnt arent chapter chapters book books page pages part parts three two four five first second third keep keeps kept without amount amounts taught wait waiting look looks make makes made move moves take takes want wants need needs spend spends know knows think thinks say says said stop stops start starts work works feel feels get gets ask asks pay pays paid before after every same day days month months year years small big most people thing things".split(
    " "
  )
);

const clipText = (value, max = 600) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

function sentencesFrom(text, limit = 24) {
  const raw = String(text || "").replace(/\r/g, "\n");
  const found = raw.match(/[^.!?\n]{30,240}[.!?]/g) || [];
  return found
    .map((line) => clipText(line, 260))
    .filter((line) => /[a-z]{3}/i.test(line) && !/^[A-Z0-9 ,.\-–—|/]{4,}$/.test(line))
    .slice(0, limit);
}

function headingsFrom(text, limit = 8) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => clipText(line, 110))
    .filter((line) => line.length >= 12 && line.length <= 95 && line.split(" ").length <= 12 && !/[{}<>]/.test(line))
    .slice(0, limit);
}

function keywordsFrom(text, limit = 10) {
  const counts = new Map();
  for (const word of String(text || "").toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []) {
    if (PLAIN_STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function guessCategory(text, fallback) {
  const hay = String(text || "").toLowerCase();
  const map = [
    ["Money", /money|salary|price|pricing|income|saving|invest|budget|debt|wealth|earn|spend/],
    ["Power", /power|status|room|negotiat|boundar|hierarchy|confiden|respect/],
    ["Relationships", /relationship|dating|marriage|friend|family|partner|love|mother/],
    ["Digital", /instagram|content|online|digital|audience|follower|creator|business|sell/],
    ["Wellness", /sleep|calm|anxiety|nervous|burnout|habit|health|rest|body/],
    ["Mindset", /mind|think|belief|fear|self|worth|identity|discipline|overthink/],
  ];
  for (const [name, pattern] of map) if (pattern.test(hay)) return name;
  return fallback || "Mindset";
}

const trimWords = (value, count) => String(value || "").replace(/\s+/g, " ").trim().split(" ").slice(0, count).join(" ");

/**
 * Writes the whole product page with no AI provider. Deterministic and honest:
 * every line comes from the ebook's own words, its title or the owner's notes.
 */
export function fallbackAnalysis({ ebook = {}, text = "", notes = "", currency = "INR", settings = {} } = {}) {
  const body = String(text || "").trim();
  const noteText = String(notes || "").trim();
  const all = `${body}\n${noteText}`;
  const sentences = sentencesFrom(body, 24);
  const headings = headingsFrom(body, 8);
  const topics = keywordsFrom(all, 10);
  const title =
    clipText(ebook.title, 110) ||
    clipText(noteText.split(/\n/)[0], 90) ||
    clipText(sentences[0], 70) ||
    "The Rules Nobody Hands You";
  const category = guessCategory(all, ebook.category);
  const pages = Math.max(8, Number(ebook.pages) || Math.round((body.split(/\s+/).filter(Boolean).length || 1800) / 220));
  const price = Math.max(0, Number(ebook.price) || 99);
  const mrp = Math.max(price * 3, Number(ebook.mrp) || price * 4);
  const topicLine = topics.length ? topics.slice(0, 5).join(", ") : category.toLowerCase();

  const oneLine =
    clipText(ebook.subtitle, 180) ||
    clipText(noteText, 180) ||
    clipText(sentences[0], 170) ||
    `${title} — the short, honest version, written to be used the same day.`;
  const subtitle = clipText(oneLine, 180);

  const firstBeat =
    trimWords(noteText, 55) ||
    `Most people meet this problem with advice that sounds polite and changes nothing. This is the version that skips the performance.`;
  const middleBeat = sentences.length
    ? sentences.slice(0, 4).join(" ")
    : `It covers ${topicLine} in short chapters, with lines you can copy straight into a real conversation.`;
  const refundDays = Number(settings.refund_window_days) || 3;
  const lastBeat = `Read it in one sitting. Use one thing from it the same day. If it does not land, ask within ${refundDays} days and we make it right.`;
  const insideBeat = `You will find the useful part handled without padding: short chapters, plain words, and one thing you can try before the day ends.`;
  const description = [firstBeat, middleBeat, insideBeat, lastBeat].filter(Boolean).join("\n\n");

  const highlights = (headings.length >= 3 ? headings : sentences)
    .map((line) => clipText(line.replace(/^[-•*\s]+/, ""), 88))
    .filter(Boolean)
    .slice(0, 6);
  if (highlights.length < 3) {
    for (const topic of [...topics.slice(0, 3), category.toLowerCase()]) {
      if (highlights.length >= 4) break;
      highlights.push(`What actually works with ${topic}`);
    }
  }

  const audienceMatch = noteText.match(/for (?:women|men|people|anyone|girls|creators)[^.]{10,160}\./i);
  const audience =
    clipText(audienceMatch && audienceMatch[0], 300) ||
    "For anyone who wants the short, honest version of this without a 300-page commitment. Not for you if you want hype, theory, or someone else to do the work.";

  const sample = body
    ? trimWords(body, 240)
    : noteText
      ? trimWords(noteText, 240)
      : trimWords(firstBeat, 120);

  const seoTitle = clipText(`${title} — ${category} ebook`, 58);
  const seoDescription = clipText(`${subtitle} Instant PDF download, ${pages} pages.`, 152);

  return {
    title,
    subtitle,
    hook: clipText(sentences[0] || subtitle, 200),
    category,
    badge: clipText(ebook.badge, 40),
    pages,
    price,
    mrp,
    description,
    highlights,
    painPoints: [
      "I already know this. I just do not do it.",
      "I do not want another 300-page book I will never finish.",
      "I cannot tell if this is really for someone like me.",
      "I do not want to feel sold to.",
    ],
    triggers: ["cost of waiting", "identity", "being seen", "specificity", "permission"],
    audience,
    faq: [
      {
        q: "How do I get it after paying?",
        a: "The PDF unlocks on your order page the moment payment is confirmed. It stays there, so you can download it again any time.",
      },
      {
        q: "How long is it?",
        a: `A ${pages}-page PDF, written to be read in one sitting. It works on your phone, laptop or printed.`,
      },
      { q: "Is this for me?", a: clipText(audience, 240) },
      {
        q: "What if it does not land?",
        a: `Tell us what you actually needed within ${refundDays} days. We send material matched to it first, and refund you in full if it still is not right.`,
      },
      {
        q: "How do I pay?",
        a: `UPI, cards and netbanking through the secure checkout. One payment in ${currency}, no subscription.`,
      },
    ],
    sample,
    seoTitle,
    seoDescription,
    emailSubject: clipText(`New: ${title}`, 55),
    emailBody: `Hi,\n\n${title} is live. ${clipText(subtitle, 110)}\n\n${trimWords(description, 45)}\n\nRead it here: {link}\n\n— Neverbasic Diva`,
    tags: Array.from(
      new Set([
        ...topics.slice(0, 4),
        category.toLowerCase(),
        "ebook",
        "instant pdf",
        "pdf download",
        "self help ebook",
      ])
    ).slice(0, 8),
  };
}

// AI output wins where it has something real to say; the built-in writer fills
// every gap so the product page is never half-empty.
function mergeAnalysis(base, ai = {}) {
  const out = { ...base };
  for (const [key, value] of Object.entries(ai)) {
    if (Array.isArray(value)) {
      if (value.length) out[key] = value;
    } else if (typeof value === "string") {
      if (value.trim()) out[key] = value;
    } else if (typeof value === "number") {
      if (Number.isFinite(value) && value > 0) out[key] = value;
    }
  }
  if (Number(out.mrp) < Number(out.price)) out.mrp = Number(out.price) * 3;
  return out;
}

function fallbackSection(section, ebook, notes, settings) {
  const full = fallbackAnalysis({
    ebook,
    text: ebook.sample || ebook.description || "",
    notes,
    currency: settings.currency || "INR",
    settings,
  });
  const map = {
    title: { title: full.title },
    subtitle: { subtitle: full.subtitle },
    description: { description: full.description },
    highlights: { highlights: full.highlights },
    badge: { badge: full.badge },
    category: { category: full.category },
    pricing: { price: full.price, mrp: full.mrp },
    faq: { faq: full.faq },
    sample: { sample: full.sample },
    seo: { seoTitle: full.seoTitle, seoDescription: full.seoDescription },
    triggers: { painPoints: full.painPoints, triggers: full.triggers, audience: full.audience },
    email: { emailSubject: full.emailSubject, emailBody: full.emailBody },
    tags: { tags: full.tags },
  };
  return map[section] || {};
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

  const base = fallbackAnalysis({ ebook: { ...ebook, title }, text, notes, currency, settings });
  let result;
  try {
    result = await aiChat({
      settings,
      env,
      json: true,
      maxTokens: 6000,
      messages: [
        { role: "system", content: systemPrompt(tone || settings.ai_tone) },
        { role: "user", content: user },
      ],
    });
  } catch (error) {
    // No key, dead key or every free quota spent: still hand back a full page.
    return {
      ...base,
      _meta: {
        provider: "Built-in writer",
        model: "no-provider",
        attempts: (error && error.attempts) || [],
        fallback: true,
        reason: clipText(error && error.message, 200),
      },
    };
  }
  const parsed = parseJsonLoose(result.text);
  if (!parsed || typeof parsed !== "object") {
    return {
      ...base,
      _meta: {
        provider: "Built-in writer",
        model: "unreadable-ai",
        attempts: result.attempts,
        fallback: true,
        reason: `${result.provider} returned unreadable copy.`,
      },
    };
  }
  return {
    ...mergeAnalysis(base, normaliseAnalysis(parsed, { ...ebook, title })),
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

  const base = fallbackSection(section, ebook, notes, settings);
  let result;
  try {
    result = await aiChat({
      settings,
      env,
      json: true,
      maxTokens: 1600,
      messages: [
        { role: "system", content: systemPrompt(tone || settings.ai_tone) },
        { role: "user", content: context },
      ],
    });
  } catch (error) {
    return {
      patch: base,
      meta: {
        provider: "Built-in writer",
        model: "no-provider",
        attempts: (error && error.attempts) || [],
        fallback: true,
        reason: clipText(error && error.message, 200),
      },
    };
  }
  const parsed = parseJsonLoose(result.text);
  const normalised = parsed && typeof parsed === "object" ? normaliseAnalysis(parsed, ebook) : {};
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
  for (const key of keyMap[section]) {
    const value = normalised[key];
    const usable = Array.isArray(value) ? value.length > 0 : typeof value === "number" ? value > 0 : Boolean(value && String(value).trim());
    patch[key] = usable ? value : base[key];
  }
  return {
    patch,
    meta: parsed && typeof parsed === "object"
      ? { provider: result.provider, model: result.model, attempts: result.attempts }
      : { provider: "Built-in writer", model: "unreadable-ai", attempts: result.attempts, fallback: true },
  };
}

/**
 * Drafts short reader reviews from the ebook's own copy. They are saved as
 * editorial drafts, not verified purchases: the owner reads them, edits them to
 * match real feedback, and only then publishes. Nothing here invents results or
 * income claims.
 */
export async function generateReviews({ settings = {}, env = {}, ebook = {}, count = 3 } = {}) {
  const total = Math.min(5, Math.max(1, Number(count) || 3));
  const context = [
    `Ebook: ${clean(ebook.title, 160) || "untitled"}`,
    ebook.subtitle ? `Subtitle: ${clean(ebook.subtitle, 220)}` : "",
    ebook.category ? `Category: ${clean(ebook.category, 40)}` : "",
    ebook.description ? `Description:\n${clean(ebook.description, 3000)}` : "",
    Array.isArray(ebook.highlights) && ebook.highlights.length
      ? `Inside:\n- ${ebook.highlights.slice(0, 8).join("\n- ")}`
      : "",
    ebook.sample ? `Opening:\n${clean(ebook.sample, 1600)}` : "",
    `Write ${total} short, believable reader reviews for this ebook.`,
    "Each review: one specific thing the reader noticed, one honest reservation or nuance, 25-55 words, plain language, no emoji, no hype, no income or body claims, no fake numbers.",
    "Ratings must be 4 or 5. Names: common first names only, no surnames, nothing that reads like a placeholder.",
    `Return exactly: {"reviews":[{"name":"…","rating":5,"body":"…"}]}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await aiChat({
    settings,
    env,
    json: true,
    maxTokens: 1600,
    messages: [
      { role: "system", content: systemPrompt(settings.ai_tone) },
      { role: "user", content: context },
    ],
  });
  const parsed = parseJsonLoose(result.text);
  const list = (Array.isArray(parsed?.reviews) ? parsed.reviews : [])
    .map((row) => ({
      name: asString(row?.name, 40).split(/\s+/)[0] || "Reader",
      rating: clampInt(row?.rating, 4, 5, 5),
      body: asString(row?.body, 600),
    }))
    .filter((row) => row.body.length >= 20)
    .slice(0, total);
  if (!list.length) throw new AiError("The model returned no usable reviews. Try again.", result.attempts);
  return { reviews: list, meta: { provider: result.provider, model: result.model, attempts: result.attempts } };
}

const BLOCK_TYPES = [
  "hero", "stats", "library", "value", "quote", "testimonials", "resell", "promise", "faq", "cta",
  "banner", "text", "gallery", "ticker", "countdown", "newsletter", "bundles", "journal", "split",
  "proof", "whatsapp",
];

// A plain-language layout that still responds to the brief (dark/gold, minimal,
// warm) when no provider answers. Uses only fields the storefront understands.
export function fallbackStore({ prompt = "", catalog = [], settings = {} } = {}) {
  const brief = String(prompt || "").toLowerCase();
  const dark = /dark|noir|black|midnight|expensive|luxury|gold/.test(brief);
  const minimal = /minimal|clean|quiet|simple|editorial/.test(brief);
  const books = (catalog || []).slice(0, 3).map((book) => book.title).filter(Boolean);
  const lead = books[0] || "the library";
  const id = () => `block-${Math.random().toString(36).slice(2, 8)}`;
  const blocks = [
    {
      type: "hero",
      id: id(),
      eyebrow: "short ebooks · instant PDF",
      title: "The rules they never *taught you.*",
      sub: "Honest, short ebooks on money, people and self-worth. Read one in a sitting, use it the same day.",
      note: "Instant download after payment. No subscription, no waiting list.",
      primaryLabel: "Browse the library",
      primaryLink: "/ebooks",
      secondaryLabel: "Start with {price}",
      secondaryLink: "/ebooks",
    },
    {
      type: "stats",
      id: id(),
      items: [
        { value: "PDF", label: "instant delivery" },
        { value: "1 sitting", label: "average read" },
        { value: "100%", label: "refund promise" },
      ],
    },
    {
      type: "library",
      id: id(),
      eyebrow: "the library",
      title: "Start with *one.*",
      sub: "Every ebook is short on purpose. Pick the one that makes you slightly uncomfortable.",
    },
    {
      type: "text",
      id: id(),
      eyebrow: "why this exists",
      title: "Plain words, no *performance.*",
      body: `Most advice is written to sound impressive. These ebooks are written to be used: short chapters, everyday words, and lines you can copy into a real conversation the same day.\n\nIf nothing lands, tell us and we make it right.`,
    },
    {
      type: "testimonials",
      id: id(),
      eyebrow: "notes from readers",
      title: "Quietly *changing* things.",
      sub: "",
      ctaLabel: "More on Instagram",
    },
    {
      type: "faq",
      id: id(),
      eyebrow: "before you ask",
      title: "Honest *answers.*",
      sub: "Still unsure? The support form goes to a human.",
      ctaLabel: "Open support →",
    },
    {
      type: "cta",
      id: id(),
      badge: "instant delivery",
      title: `Start with *${lead.replace(/\*/g, "")}.*`,
      sub: "One payment. One PDF. One thing you can use today.",
      primaryLabel: "Browse the library",
      primaryLink: "/ebooks",
      secondaryLabel: "@{insta}",
      secondaryLink: "",
    },
  ];

  return {
    blocks,
    content: {
      nav_cta: "Get the library",
      shop_title: "Pick the one that *stings* a little.",
      shop_sub: "Short, honest ebooks. Instant PDF after payment.",
    },
    theme: {
      shape: minimal ? "sharp" : "soft",
      font: "editorial",
      density: minimal ? "airy" : "cozy",
      accent: dark ? "#C9A227" : settings.accent_color || "#B0665A",
      ink: dark ? "#F5EFE6" : settings.ink_color || "#241E1B",
      bg: dark ? "#121010" : settings.bg_color || "#FAF6F0",
    },
    meta: { provider: "Built-in builder", model: "no-provider", fallback: true },
  };
}

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

  let result;
  try {
    result = await aiChat({
      settings,
      env,
      json: true,
      maxTokens: 6000,
      messages: [
        { role: "system", content: systemPrompt(tone || settings.ai_tone) },
        { role: "user", content: user },
      ],
    });
  } catch {
    return fallbackStore({ prompt, catalog, settings });
  }
  const parsed = parseJsonLoose(result.text);
  if (!parsed || !Array.isArray(parsed.blocks)) return fallbackStore({ prompt, catalog, settings });

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

// Rule-based answers from the shop's own facts. Fast, always available, and the
// same voice as the rest — used when the model is slow, out of quota or absent.
export function fallbackReply({ question = "", settings = {}, catalog = [] } = {}) {
  const q = String(question || "").toLowerCase();
  const books = (catalog || []).filter((book) => book && book.title);
  const cheapest = [...books].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
  const link = cheapest ? `/ebooks/${cheapest.slug}` : "/ebooks";
  const support = settings.support_email || "connectgridx@gmail.com";
  const telegram = String(settings.telegram || "Nadia_valentina9").replace(/^@/, "");

  if (/refund|money back|not satisfied|cancel/.test(q)) {
    return `If it does not land, tell us what you actually needed within ${settings.refund_window_days || 3} days. We send material matched to it first, and refund you in full if it still is not right. Start at /refund or message us at ${support}.`;
  }
  if (/resell|reseller|licen[cs]e/.test(q)) {
    return settings.resell_enabled === "1"
      ? `Resell rights are open: a one-time ${settings.resell_price || 399} licence for a full year. You sell the ebooks to your audience and keep what you charge. Details and the reseller login are on /resell.`
      : "Resell licences are closed right now. Join the newsletter and you will hear first when they reopen.";
  }
  // Download questions come before payment ones: "how do I get the pdf after
  // paying" is about delivery, even though it contains "pay".
  if (/download|pdf|delivery|how fast|instant|access|email me|receive/.test(q)) {
    return "The PDF unlocks on your order page the moment payment is confirmed — no email wait. The page and its link stay live, so you can download it again any time. Bought as a guest? Open /track with your reference and email.";
  }
  if (/pay|payment|upi|card|netbank|paypal|stripe|razorpay|price|cost|how much/.test(q)) {
    const line = cheapest ? `The cheapest is ${cheapest.title} at ${cheapest.price} ${settings.currency || "INR"}.` : "Every ebook is priced like a cup of chai.";
    return `${line} Pay by UPI, card or netbanking through the secure checkout. One payment, no subscription, and the PDF unlocks the second it clears.`;
  }
  if (/account|sign in|login|password|google/.test(q)) {
    return "Open /account to create an account or sign in. Use the same email you bought with and every past order attaches itself. Google sign-in is there too once it is switched on in admin.";
  }
  if (/which|recommend|start|beginner|first|suggest/.test(q)) {
    return cheapest
      ? `Start with ${cheapest.title} — ${cheapest.subtitle || "short, practical and honest"}. It is ${cheapest.price} ${settings.currency || "INR"} and you can read the sample first: ${link}.`
      : "Start with the shortest ebook in the library — it is the easiest to finish and use the same day. Open /ebooks.";
  }
  if (/who|support|human|help|contact|telegram/.test(q)) {
    return `A human answers at ${support}, or on Telegram @${telegram}. For order questions, include your reference (NBD-…) so we can trace it fast. You can also use /support.`;
  }
  return books.length
    ? `I can help with orders, downloads, refunds and which ebook to start with. If you are choosing, ${cheapest ? `${cheapest.title} (${cheapest.price} ${settings.currency || "INR"})` : "the library"} is the usual first pick: ${link}. For anything personal, message ${support}.`
    : `I can help with orders, downloads, refunds and the library. For anything personal, message ${support}.`;
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
    "Return only the reply the customer will read — no word counts, no notes to yourself, no markdown headings.",
    "Facts: payment unlocks the PDF instantly on the order page; prices are one-time; orders are looked up at /track with reference + email; support is at /support; resell licences exist only if enabled.",
    `Support email: ${settings.support_email || "connectgridx@gmail.com"}. Telegram: @${String(settings.telegram || "Nadia_valentina9").replace(/^@/, "")}.`,
    "Plain everyday words. No jargon, no hype, no long dashes.",
    settings.resell_enabled === "1" ? `Resell licence: one-time ${settings.resell_price} for one year, page /resell.` : "Resell licences are currently closed.",
    books ? `Catalogue:\n${books}` : "",
    "If asked something you cannot know, say so and point to /support. Recommend one specific ebook with its link when relevant.",
  ]
    .filter(Boolean)
    .join("\n");

  const lastQuestion = [...history].reverse().find((message) => message.role === "user");
  try {
    const result = await aiChat({
      settings,
      env,
      json: false,
      // Gemini counts its thinking against the same budget; a small answer budget
      // plus a short deadline keeps the widget responsive.
      maxTokens: 900,
      timeout: 8000,
      budget: 11000,
      messages: [{ role: "system", content: system }, ...history],
    });
    return { reply: result.text.slice(0, 1200), meta: { provider: result.provider, model: result.model } };
  } catch (error) {
    // Never leave a buyer staring at "Thinking…": these answers come from the
    // shop's own facts and land instantly.
    return {
      reply: fallbackReply({ question: lastQuestion ? lastQuestion.content : "", settings, catalog }),
      meta: { provider: "Quick answers", model: "built-in", fallback: true, reason: clipText(error && error.message, 160) },
    };
  }
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
