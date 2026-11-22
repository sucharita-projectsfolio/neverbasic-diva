// Client-side counterpart of worker/seo.js: keeps the tab title, description,
// canonical and structured data correct while the visitor moves between pages
// (and for crawlers that do run scripts). Server-side injection covers the
// first paint; this keeps it true after a client-side route change.

const esc = (value) => String(value == null ? "" : value);

function setTag(attr, key, content) {
  if (!content) return;
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export function applySeo({ title, description, canonical, image, robots = "index, follow", jsonLd = [] }) {
  if (typeof document === "undefined") return;
  if (title) document.title = title;
  setTag("name", "description", description);
  setTag("name", "robots", robots);
  setTag("property", "og:title", title);
  setTag("property", "og:description", description);
  setTag("property", "og:url", canonical);
  setTag("property", "og:type", "website");
  setTag("name", "twitter:card", "summary_large_image");
  setTag("name", "twitter:title", title);
  setTag("name", "twitter:description", description);
  if (image) setTag("property", "og:image", image);

  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  if (canonical) link.setAttribute("href", canonical);

  // Swap out structured data written by the server or an earlier route so a
  // page never carries two versions of the same schema.
  document.head.querySelectorAll("script[data-seo]").forEach((node) => node.remove());
  for (const block of jsonLd.filter(Boolean)) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seo = "client";
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  }
}

const clip = (value, max = 158) => {
  const text = esc(value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

// Keeps the search title under 65 characters even when the AI title is long:
// trim the promise, never the brand.
function titleWithBrand(value, brand) {
  const text = esc(value).replace(/\s+/g, " ").trim();
  if (!brand || text.toLowerCase().includes(brand.toLowerCase())) return clip(text, 65);
  const suffix = ` | ${brand}`;
  return `${clip(text, Math.max(24, 65 - suffix.length))}${suffix}`;
}

function ebookSeo(ebook, brand, canonical, home) {
  const ai = ebook.ai_meta && typeof ebook.ai_meta === "object" ? ebook.ai_meta : {};
  const description = clip(ai.seoDescription || ebook.description || ebook.subtitle || `${ebook.title} — an ebook by ${brand}.`);
  const seoTitle = titleWithBrand(ai.seoTitle || `${ebook.title} — ${ebook.category} ebook`, brand);
  return {
    title: seoTitle,
    description,
    image: ebook.cover || undefined,
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
        author: { "@type": "Organization", name: brand },
        offers: {
          "@type": "Offer",
          url: canonical,
          price: Number(ebook.price) || 0,
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  };
}

export function seoForPath(pathname, site, overrides = {}) {
  const settings = (site && site.settings) || {};
  const brand = settings.brand_name || "Neverbasic Diva";
  const tagline = settings.brand_tagline || "micro-ebooks on money, people and power";
  const ebooks = (site && site.ebooks) || [];
  // The design studio's hero block is the visible copy; hero_* settings are the
  // legacy fallback. Meta text follows whichever one the visitor can see.
  const heroBlock = ((site && site.blocks) || []).find((row) => row && row.type === "hero" && !row.hidden);
  const heroSub = (heroBlock && heroBlock.sub) || settings.hero_sub || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const clean = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const canonical = `${origin}${clean === "/" ? "/" : clean}`;
  const home = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand,
    url: origin,
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
  };

  const base = {
    title: `${brand} — ${tagline}`,
    description: clip(heroSub || tagline),
    canonical,
    jsonLd: [home, org],
  };

  if (clean === "/") {
    return {
      ...base,
      title: overrides.title || `${brand} — ebooks on money, earning, boundaries and self-worth`,
      description: clip(
        overrides.description ||
          heroSub ||
          "The knowledge most people never get: short, honest ebooks on money, earning, people and self-worth."
      ),
    };
  }

  if (clean === "/ebooks") {
    return {
      ...base,
      title: `Ebook library — ${ebooks.length} instant-download ebooks | ${brand}`,
      description: clip(
        `Browse ${ebooks.length} short ebooks on money, earning, people and self-worth. Instant PDF after payment.`
      ),
    };
  }

  if (clean.startsWith("/ebooks/")) {
    const slug = decodeURIComponent(clean.slice("/ebooks/".length));
    const ebook = ebooks.find((book) => book.slug === slug);
    if (!ebook) return { ...base, title: `Ebook not found | ${brand}`, robots: "noindex, follow" };
    return { ...base, ...ebookSeo(ebook, brand, canonical, home) };
  }

  if (clean === "/resell") {
    const price = Number(settings.resell_price) || 399;
    return {
      ...base,
      title: `Resell our ebooks and earn — reseller licence ₹${price} | ${brand}`,
      description: clip(
        `Buy the reseller licence for ₹${price}, set your own price and keep 100% of every sale. Source PDFs and a reseller portal included.`
      ),
    };
  }

  if (clean === "/journal") {
    return {
      ...base,
      title: `Journal — notes on money, people and self-worth | ${brand}`,
      description: "Essays on money, earning, boundaries and self-worth.",
    };
  }

  const pages = {
    "/support": ["Help and support", "Order help, refund questions and a direct line to the store."],
    "/track": ["Track your order", "Find any order with your reference and email, re-download your PDF any time."],
    "/policies": ["Policies, terms and licence", "Refund window, licence terms, privacy and delivery policy."],
    "/refund": ["Refund request", "Ask for a refund or a replacement inside the refund window.", "noindex, follow"],
    "/request": ["Request an ebook", "Tell us what you want written next.", "noindex, follow"],
    "/search": ["Search the library", "Search every ebook in the catalogue.", "noindex, follow"],
    "/wishlist": ["Your wishlist", "Ebooks you saved on this device.", "noindex, follow"],
    "/account": ["Your account", "Orders, downloads and support threads.", "noindex, follow"],
    "/checkout": ["Secure checkout", "Complete your order.", "noindex, follow"],
  };
  const key = Object.keys(pages).find((route) => clean === route || clean.startsWith(`${route}/`));
  if (key) {
    const [name, description, robots] = pages[key];
    return { ...base, title: `${name} | ${brand}`, description: clip(description), robots: robots || "index, follow" };
  }

  return base;
}
