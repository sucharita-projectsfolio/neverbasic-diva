// Search-engine layer for the storefront.
//
// The app is a single-page React build, so a crawler that does not run scripts
// only sees one generic <title>. Every HTML route therefore gets its own title,
// description, canonical, Open Graph tags, JSON-LD and a <noscript> summary
// written into the shell here, on the server. /robots.txt and /sitemap.xml are
// generated from the catalogue so new ebooks and posts appear automatically.
import { getSettings } from "./db.js";

const esc = (value) =>
  String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const clip = (value, max = 158) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

const originOf = (request, env) => {
  const configured = String((env && env.SITE_URL) || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
};

// One small cache: the shell is requested for every page view, and the
// catalogue does not change between two clicks.
let cache = { at: 0, data: null };
async function storeData(env) {
  // Short enough that a new ebook or a renamed slug shows correct tags almost
  // immediately, long enough to spare the database on a busy page view.
  if (cache.data && Date.now() - cache.at < 10_000) return cache.data;
  const settings = await getSettings(env.DB);
  const ebooks =
    (
      await env.DB.prepare(
        "SELECT title, slug, subtitle, description, price, mrp, category, pages, badge, tags, ai_meta FROM ebooks WHERE status = 'active' ORDER BY sort ASC, created_at DESC"
      ).all()
    ).results || [];
  let posts = [];
  try {
    posts =
      (
        await env.DB.prepare(
          "SELECT title, slug, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 100"
        ).all()
      ).results || [];
  } catch {
    posts = [];
  }
  cache = { at: Date.now(), data: { settings, ebooks, posts } };
  return cache.data;
}

/* ------------------------------- route head ------------------------------- */

const SKIP_PATHS = ["/admin"];

// The design studio saves the hero as a block; older stores only have the
// hero_* settings keys. The visible copy wins when both exist.
function heroCopy(settings) {
  let block = null;
  try {
    const blocks = JSON.parse(settings.site_blocks || "[]");
    block = (Array.isArray(blocks) ? blocks : []).find((row) => row && row.type === "hero" && !row.hidden) || null;
  } catch {
    block = null;
  }
  const plain = (value) => String(value || "").replace(/\*/g, "").trim();
  return {
    title: plain((block && block.title) || settings.hero_title || ""),
    sub: (block && block.sub) || settings.hero_sub || "",
  };
}

function seoFor(path, data, origin, search) {
  const settings = (data && data.settings) || {};
  const hero = heroCopy(settings);
  const brand = settings.brand_name || "Neverbasic Diva";
  const tagline = settings.brand_tagline || "micro-ebooks on money, people and power";
  const ebooks = (data && data.ebooks) || [];
  const posts = (data && data.posts) || [];
  const canonical = `${origin}${path === "/" ? "/" : path}`;

  const base = {
    title: `${brand} — ${tagline}`,
    description: clip(hero.sub || settings.brand_tagline || "Short, honest ebooks on money, people and self-worth. Instant PDF delivery."),
    canonical,
    robots: "index, follow",
    jsonLd: [],
  };

  const home = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand,
    url: origin,
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand,
    url: origin,
    description: tagline,
    sameAs: settings.instagram ? [`https://instagram.com/${String(settings.instagram).replace(/^@/, "")}`] : undefined,
  };

  if (path === "/" || path === "") {
    return {
      ...base,
      title: `${brand} — ebooks on money, earning, boundaries and self-worth`,
      description: clip(
        hero.sub ||
          "The knowledge most people never get: short, honest ebooks on money, earning, people and self-worth. Instant PDF, resell rights available."
      ),
      keywords:
        "ebooks, ebooks india, money ebook, earning ebook, self worth ebook, psychology ebook, instant pdf ebook, resell rights ebook",
      jsonLd: [home, org],
    };
  }

  if (path === "/ebooks") {
    return {
      ...base,
      title: `Ebook library — ${ebooks.length} instant-download ebooks | ${brand}`,
      description: clip(
        `Browse ${ebooks.length} short ebooks on money, earning, people and self-worth. ${ebooks
          .slice(0, 4)
          .map((book) => book.title)
          .join(", ")}. Instant PDF after payment.`
      ),
      keywords: "ebook library, buy ebook online, instant download ebook, money ebook, self help ebook india",
      jsonLd: [
        home,
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Ebook library — ${brand}`,
          url: canonical,
          hasPart: ebooks.slice(0, 20).map((book) => ({
            "@type": "Book",
            name: book.title,
            url: `${origin}/ebooks/${book.slug}`,
          })),
        },
      ],
    };
  }

  if (path.startsWith("/ebooks/")) {
    const slug = decodeURIComponent(path.slice("/ebooks/".length).replace(/\/+$/, ""));
    const ebook = ebooks.find((book) => book.slug === slug);
    if (!ebook) return { ...base, title: `Ebook not found | ${brand}`, robots: "noindex, follow" };
    // The Studio writes a search title, a search description and tags with the
    // product page. Use them when they exist; fall back to the page copy.
    let ai = {};
    let tags = [];
    try {
      ai = JSON.parse(ebook.ai_meta || "{}") || {};
    } catch {
      ai = {};
    }
    try {
      tags = JSON.parse(ebook.tags || "[]") || [];
    } catch {
      tags = [];
    }
    const description = clip(
      ai.seoDescription || ebook.description || ebook.subtitle || `${ebook.title} — an ebook by ${brand}.`
    );
    const seoTitle = clip(ai.seoTitle || `${ebook.title} — ${ebook.category} ebook`, 60);
    return {
      ...base,
      title: seoTitle.includes(brand) ? seoTitle : `${seoTitle} | ${brand}`,
      description,
      image: ebook.cover || undefined,
      keywords: Array.from(
        new Set([
          ...(Array.isArray(tags) ? tags : []),
          ebook.title,
          `${ebook.category} ebook`,
          `buy ${ebook.title.toLowerCase()}`,
          "ebook pdf download",
          brand,
        ])
      ).join(", "),
      jsonLd: [
        home,
        {
          "@context": "https://schema.org",
          "@type": "Book",
          name: ebook.title,
          bookFormat: "https://schema.org/EBook",
          inLanguage: "en",
          description,
          url: canonical,
          numberOfPages: Number(ebook.pages) || undefined,
          author: { "@type": "Organization", name: brand },
          publisher: { "@type": "Organization", name: brand },
          offers: {
            "@type": "Offer",
            url: canonical,
            price: Number(ebook.price) || 0,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
            { "@type": "ListItem", position: 2, name: "Library", item: `${origin}/ebooks` },
            { "@type": "ListItem", position: 3, name: ebook.title, item: canonical },
          ],
        },
      ],
    };
  }

  if (path === "/resell") {
    const price = Number(settings.resell_price) || 399;
    return {
      ...base,
      title: `Resell our ebooks and earn — reseller licence ₹${price} | ${brand}`,
      description: clip(
        `Buy the reseller licence for ₹${price}, set your own price and keep 100% of every sale. Source PDFs, your own links and a reseller portal included.`
      ),
      keywords: "resell ebooks, ebook reseller india, earn from ebooks, resell rights, digital product reselling",
      jsonLd: [
        home,
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${brand} reseller licence`,
          description: "Reseller licence for the full ebook catalogue with source PDFs and a reseller portal.",
          offers: { "@type": "Offer", price, priceCurrency: "INR", availability: "https://schema.org/InStock", url: canonical },
        },
      ],
    };
  }

  if (path === "/journal") {
    return {
      ...base,
      title: `Journal — notes on money, people and self-worth | ${brand}`,
      description: clip(
        `Essays and notes on money, earning, boundaries and self-worth. ${posts.slice(0, 3).map((post) => post.title).join(" · ")}`
      ),
      keywords: "money blog india, self worth articles, boundaries blog, earning notes",
      jsonLd: [home],
    };
  }

  if (path.startsWith("/journal/")) {
    const slug = decodeURIComponent(path.slice("/journal/".length).replace(/\/+$/, ""));
    const post = posts.find((row) => row.slug === slug);
    if (!post) return { ...base, robots: "noindex, follow" };
    return {
      ...base,
      title: `${post.title} | ${brand}`,
      description: clip(post.excerpt || post.title),
      jsonLd: [
        home,
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: clip(post.excerpt || post.title),
          datePublished: post.published_at || undefined,
          url: canonical,
          author: { "@type": "Organization", name: brand },
        },
      ],
    };
  }

  const pages = {
    "/support": ["Help and support", "Order help, refund questions and a direct line to the store."],
    "/track": ["Track your order", "Find any order with your reference and email, re-download your PDF any time."],
    "/refund": ["Refund request", "Ask for a refund or a replacement inside the refund window.", "noindex, follow"],
    "/request": ["Request an ebook", "Tell us what you want written next.", "noindex, follow"],
    "/policies": ["Policies, terms and licence", "Refund window, licence terms, privacy and delivery policy."],
    "/search": ["Search the library", "Search every ebook in the catalogue.", "noindex, follow"],
    "/wishlist": ["Your wishlist", "Ebooks you saved on this device.", "noindex, follow"],
    "/account": ["Your account", "Orders, downloads and support threads.", "noindex, follow"],
    "/checkout": ["Secure checkout", "Complete your order.", "noindex, follow"],
  };
  const key = Object.keys(pages).find((route) => path === route || path.startsWith(`${route}/`));
  if (key) {
    const [name, description, robots] = pages[key];
    return { ...base, title: `${name} | ${brand}`, description: clip(description), robots: robots || "index, follow", jsonLd: [home] };
  }

  return { ...base, title: `${brand} — ${tagline}`, jsonLd: [home] };
}

/* --------------------------------- inject -------------------------------- */

function injectHead(html, seo, origin) {
  const tags = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    seo.keywords ? `<meta name="keywords" content="${esc(seo.keywords)}" />` : "",
    `<meta name="robots" content="${esc(seo.robots || "index, follow")}" />`,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(new URL(origin).host)}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(seo.canonical)}" />`,
    seo.image ? `<meta property="og:image" content="${esc(seo.image)}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    ...(seo.jsonLd || []).map(
      (block) => `<script type="application/ld+json" data-seo="server">${json(block)}</script>`
    ),
    `<noscript><h1>${esc(seo.title)}</h1><p>${esc(seo.description)}</p>` +
      `<p><a href="${esc(origin)}/ebooks">Browse the ebook library</a> · ` +
      `<a href="${esc(origin)}/resell">Resell and earn</a> · ` +
      `<a href="${esc(origin)}/support">Support</a></p></noscript>`,
  ]
    .filter(Boolean)
    .join("\n    ");

  // Drop the shell's own title and any generic social/robots tags so a page is
  // never described twice (two canonicals would confuse a crawler).
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+(?:name|property)="(?:description|robots|keywords|og:[a-z:]+|twitter:[a-z]+)"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<\/head>/i, `  ${tags}\n  </head>`);
  return out;
}

/* -------------------------------- endpoints ------------------------------- */

const xml = (text) =>
  new Response(text, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" },
  });
const plain = (text) =>
  new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=600" },
  });

function robotsTxt(origin) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /order",
    "Disallow: /wishlist",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

function sitemapXml(origin, data) {
  const ebooks = (data && data.ebooks) || [];
  const posts = (data && data.posts) || [];
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    { loc: "/", priority: "1.0", freq: "daily" },
    { loc: "/ebooks", priority: "0.9", freq: "daily" },
    { loc: "/resell", priority: "0.8", freq: "weekly" },
    { loc: "/journal", priority: "0.6", freq: "weekly" },
    { loc: "/support", priority: "0.5", freq: "monthly" },
    { loc: "/policies", priority: "0.4", freq: "monthly" },
    { loc: "/track", priority: "0.4", freq: "monthly" },
  ];
  const rows = [
    ...pages.map((page) => ({ loc: `${origin}${page.loc}`, priority: page.priority, freq: page.freq })),
    ...ebooks.map((book) => ({ loc: `${origin}/ebooks/${book.slug}`, priority: "0.8", freq: "weekly" })),
    ...posts.map((post) => ({ loc: `${origin}/journal/${post.slug}`, priority: "0.6", freq: "monthly" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows
  .map(
    (row) =>
      `  <url><loc>${esc(row.loc)}</loc><lastmod>${today}</lastmod><changefreq>${row.freq}</changefreq><priority>${row.priority}</priority></url>`
  )
  .join("\n")}
</urlset>`;
}

// Everything that is not /api/ reaches this: SEO endpoints, then the SPA shell
// with its per-route head written in, then a plain asset for anything else.
export async function servePage(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const origin = originOf(request, env);

  if (path === "/robots.txt" && request.method === "GET") return plain(robotsTxt(origin));
  if (path === "/sitemap.xml" && request.method === "GET") {
    const data = await storeData(env).catch(() => null);
    return xml(sitemapXml(origin, data));
  }

  const response = await env.ASSETS.fetch(request);
  const type = response.headers.get("content-type") || "";
  const isHtml = type.includes("text/html");
  const skip = SKIP_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (request.method !== "GET" || !isHtml || skip) return response;

  let data = null;
  try {
    data = await storeData(env);
  } catch {
    data = null;
  }
  const seo = seoFor(path, data, origin, url.searchParams);
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  return new Response(injectHead(html, seo, origin), { status: response.status, headers });
}
