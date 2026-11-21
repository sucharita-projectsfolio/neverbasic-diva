// Store-builder schema: section catalogue, copy defaults and look settings.
// The admin design studio writes three JSON settings (site_blocks, site_content,
// site_theme) and the storefront merges them over these defaults, so a store
// that has never been customised still renders exactly like the original design.

/* --------------------------------- look ---------------------------------- */

export const SHAPES = [
  { id: "soft", label: "Soft editorial", hint: "Gentle corners, the original look", sm: 12, md: 18, lg: 26 },
  { id: "pill", label: "Pill & bubble", hint: "Very round cards and buttons", sm: 999, md: 30, lg: 44 },
  { id: "sharp", label: "Sharp minimal", hint: "Almost square, magazine grid feel", sm: 3, md: 5, lg: 8 },
  { id: "arch", label: "Arch", hint: "Tall arch corners on cards and images", sm: 16, md: 28, lg: 100 },
  { id: "brutal", label: "Brutalist", hint: "Zero radius, hard edges", sm: 0, md: 0, lg: 0 },
];

export const FONTS = [
  {
    id: "editorial",
    label: "Fraunces + Inter",
    hint: "The original: high-contrast serif headlines",
    display: '"Fraunces", "Times New Roman", serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "modern",
    label: "Inter everywhere",
    hint: "Clean, techy, all-sans",
    display: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "classic",
    label: "Georgia + Inter",
    hint: "Warm classic serif, no webfont needed",
    display: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "mono",
    label: "Mono + Inter",
    hint: "Editorial mono headlines",
    display: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
];

export const DENSITIES = [
  { id: "airy", label: "Airy", hint: "More breathing room between sections" },
  { id: "cozy", label: "Cozy", hint: "The original spacing" },
  { id: "compact", label: "Compact", hint: "Tighter, more per screen" },
];

export const DEFAULT_THEME = {
  shape: "soft",
  font: "editorial",
  density: "cozy",
  announcementSpeed: "normal",
  offerEndsAt: "",
  seoTitle: "",
  seoDescription: "",
  ogImage: "",
  customCss: "",
  showAnnouncement: true,
  preset: "",
};

// One-click complete looks. Applying a preset sets shape + type + spacing + the
// three brand colours; every value stays editable afterwards.
export const THEME_PRESETS = [
  {
    id: "rose-editorial",
    label: "Rose editorial",
    hint: "The original — warm cream, muted rose, high-contrast serif",
    accent: "#B0665A",
    ink: "#241E1B",
    bg: "#FAF6F0",
    shape: "soft",
    font: "editorial",
    density: "cozy",
  },
  {
    id: "noir-femme",
    label: "Noir femme",
    hint: "Near-black canvas, warm ivory type, wine accent",
    accent: "#C2554F",
    ink: "#F4EDE4",
    bg: "#14100F",
    shape: "sharp",
    font: "editorial",
    density: "cozy",
  },
  {
    id: "neon-diva",
    label: "Neon diva",
    hint: "Electric lime on charcoal, hard edges, mono headlines",
    accent: "#C6F24E",
    ink: "#F5F5F0",
    bg: "#111312",
    shape: "brutal",
    font: "mono",
    density: "compact",
  },
  {
    id: "cream-minimal",
    label: "Cream minimal",
    hint: "Bone white, black type, one quiet accent",
    accent: "#8C3B2E",
    ink: "#1B1A18",
    bg: "#FBF9F4",
    shape: "sharp",
    font: "modern",
    density: "airy",
  },
  {
    id: "emerald-luxe",
    label: "Emerald luxe",
    hint: "Deep forest, soft gold, arch shapes",
    accent: "#C9A227",
    ink: "#F7F3E8",
    bg: "#0E2A22",
    shape: "arch",
    font: "classic",
    density: "airy",
  },
  {
    id: "midnight-gold",
    label: "Midnight gold",
    hint: "Navy night, champagne accents, pill buttons",
    accent: "#E4B363",
    ink: "#F3EFE6",
    bg: "#0F1729",
    shape: "pill",
    font: "editorial",
    density: "cozy",
  },
  {
    id: "blush-pastel",
    label: "Blush pastel",
    hint: "Soft pink, plum ink, very round and friendly",
    accent: "#C2185B",
    ink: "#3A2430",
    bg: "#FDF0F4",
    shape: "pill",
    font: "modern",
    density: "airy",
  },
  {
    id: "brutal-pop",
    label: "Brutal pop",
    hint: "Acid yellow, black type, zero radius",
    accent: "#FFD400",
    ink: "#0B0B0B",
    bg: "#F5F1E6",
    shape: "brutal",
    font: "mono",
    density: "compact",
  },
  {
    id: "terracotta-sun",
    label: "Terracotta sun",
    hint: "Clay, oat and olive — slow-living editorial",
    accent: "#A34A28",
    ink: "#2C2620",
    bg: "#F6EFE4",
    shape: "arch",
    font: "classic",
    density: "cozy",
  },
  {
    id: "slate-studio",
    label: "Slate studio",
    hint: "Cool grey, cobalt accent, clean sans everywhere",
    accent: "#2F5BEA",
    ink: "#12161F",
    bg: "#F3F5F9",
    shape: "soft",
    font: "modern",
    density: "compact",
  },
];

/* --------------------------------- copy ---------------------------------- */

export const DEFAULT_CONTENT = {
  // navigation
  nav_library: "Library",
  nav_resell: "Resell rights",
  nav_support: "Support",
  nav_order: "My order",
  nav_cta: "Shop the library",
  // footer
  footer_explore: "Explore",
  footer_care: "Care",
  footer_payments: "Payments",
  footer_link_request: "Request an ebook",
  footer_link_track: "Find my order",
  footer_link_support: "Help & support",
  footer_link_refund: "Refund promise",
  footer_link_policies: "Licence & privacy",
  footer_link_email: "Email us",
  footer_note_1: "Secure checkout via PayU · UPI · cards",
  footer_note_2: "Instant PDF delivery after payment",
  footer_admin: "Admin",
  footer_rights: "All rights reserved.",
  footer_fine: "Every ebook is original work. Reselling without a licence is not permitted.",
  // shop page
  shop_eyebrow: "the full library",
  shop_title: "Read it tonight, *use it tomorrow.*",
  shop_sub:
    "Every ebook is short, specific and priced like a snack. Instant PDF access the moment payment clears — plus a lifetime order page you can return to.",
  // misc chrome
  loading: "Opening the library…",
  offer_label: "offer ends in",
};

/* -------------------------------- sections -------------------------------- */

const text = (key, label, hint) => ({ key, label, type: "text", hint });
const area = (key, label, hint) => ({ key, label, type: "textarea", hint });
const select = (key, label, options) => ({ key, label, type: "select", options });
const image = (key, label) => ({ key, label, type: "image", hint: "Paste an image URL or upload one." });
const link = (key, label) => ({ key, label, type: "text", hint: "A path like /ebooks, or a full https:// link." });

export const BLOCK_TYPES = [
  {
    type: "hero",
    label: "Hero",
    glyph: "✦",
    hint: "The first screen. Four layouts, with or without covers.",
    defaults: {
      eyebrow: "micro-ebooks for women who refuse to stay basic",
      title: "The rules they never taught you.",
      sub: "Sharp, honest, uncomfortably useful ebooks on money, people and self-worth. Priced like a cup of chai — built to change how you move for years.",
      note: "Every ebook is delivered the second your payment clears. No email chasing, no waiting list.",
      primaryLabel: "Open the library",
      primaryLink: "/ebooks",
      secondaryLabel: "Resell & earn",
      secondaryLink: "/resell",
      image: "",
      layout: "split",
      art: "stack",
      height: "normal",
      stickerTop: "from",
      stickerNote: "ek chai se sasta",
      artNote1: "no fluff",
      artNote2: "just the unspoken part",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Headline", "Wrap words in *asterisks* to italicise them."),
      area("sub", "Paragraph"),
      text("note", "Small note under the buttons"),
      text("primaryLabel", "Main button text"),
      link("primaryLink", "Main button link"),
      text("secondaryLabel", "Second button text"),
      link("secondaryLink", "Second button link"),
      select("layout", "Layout", [
        ["split", "Split — text left, covers right"],
        ["centered", "Centered — text only, mid page"],
        ["banner", "Full-width image banner"],
        ["minimal", "Minimal — text on plain background"],
      ]),
      select("art", "Cover arrangement", [
        ["stack", "Stacked covers"],
        ["fan", "Fanned covers"],
        ["single", "One cover"],
        ["none", "No covers"],
      ]),
      select("height", "Section height", [
        ["normal", "Normal"],
        ["tall", "Tall"],
        ["compact", "Compact"],
      ]),
      image("image", "Banner / side image"),
      text("stickerTop", "Price sticker top line"),
      text("stickerNote", "Price sticker bottom line"),
      text("artNote1", "Art note line 1"),
      text("artNote2", "Art note line 2"),
    ],
  },
  {
    type: "stats",
    label: "Numbers strip",
    glyph: "▤",
    hint: "A thin band of proof numbers.",
    defaults: {
      eyebrow: "",
      style: "plain",
      items: [
        { value: "12,400+", label: "readers" },
        { value: "4.9/5", label: "reader rating" },
        { value: "2 min", label: "average read" },
        { value: "100%", label: "refund honour" },
      ],
    },
    fields: [
      text("eyebrow", "Eyebrow (optional)"),
      select("style", "Style", [
        ["plain", "Plain numbers"],
        ["boxed", "Boxed cards"],
        ["bar", "Single bar"],
      ]),
      {
        key: "items",
        label: "Numbers",
        type: "items",
        itemFields: [
          { key: "value", label: "Value" },
          { key: "label", label: "Label" },
        ],
      },
    ],
  },
  {
    type: "library",
    label: "Ebook library",
    glyph: "❏",
    hint: "Your catalogue, pulled live from Ebooks.",
    defaults: {
      eyebrow: "the library",
      title: "Small books. *Unfair* advantage.",
      sub: "",
      ctaLabel: "See all ebooks",
      ctaLink: "/ebooks",
      layout: "masonry",
      onlyFeatured: false,
      limit: 0,
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      text("ctaLabel", "Link text"),
      link("ctaLink", "Link destination"),
      select("layout", "Grid style", [
        ["masonry", "Masonry"],
        ["grid", "Even grid"],
        ["list", "List rows"],
      ]),
      { key: "onlyFeatured", label: "Only featured ebooks", type: "toggle" },
      { key: "limit", label: "Max ebooks (0 = all)", type: "number" },
    ],
  },
  {
    type: "value",
    label: "Value cards",
    glyph: "◫",
    hint: "Numbered proof cards.",
    defaults: {
      eyebrow: "why this hits different",
      title: "Not another *motivational* PDF.",
      sub: "Every page is built to be used the same day. Frameworks, scripts and numbers — not vibes.",
      shape: "card",
      items: [
        {
          mark: "01",
          title: "One sitting, not one month",
          text: "Written tight. You can read any ebook on a commute and still have something to apply tonight.",
        },
        {
          mark: "02",
          title: "The part nobody says out loud",
          text: "The exact lines to use, the numbers to ask for, the dynamics people pretend don't exist.",
        },
        {
          mark: "03",
          title: "Priced to travel",
          text: "Less than a coffee, because the point is that you actually buy it instead of saving it for later.",
        },
        {
          mark: "04",
          title: "Yours, tracked, guaranteed",
          text: "Instant access after payment, a permanent order page, and a real 100% refund promise.",
        },
      ],
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      select("shape", "Card style", [
        ["card", "Filled cards"],
        ["border", "Outlined cards"],
        ["plain", "No cards, just text"],
      ]),
      {
        key: "items",
        label: "Cards",
        type: "items",
        itemFields: [
          { key: "mark", label: "Mark (01, ★…)" },
          { key: "title", label: "Title" },
          { key: "text", label: "Text", type: "textarea" },
        ],
      },
    ],
  },
  {
    type: "quote",
    label: "Quote band",
    glyph: "❝",
    hint: "One loud line from a reader.",
    defaults: {
      eyebrow: "a reader, last week",
      text: "I read Soft Power on a Tuesday and used one line in a meeting on Wednesday. My manager asked where I learned to talk like that.",
      by: "— @thegirlwhonegotiated",
      image: "",
    },
    fields: [text("eyebrow", "Eyebrow"), area("text", "Quote"), text("by", "Attribution"), image("image", "Background image")],
  },
  {
    type: "testimonials",
    label: "Reviews wall",
    glyph: "★",
    hint: "Pulls live testimonials from Reviews.",
    defaults: {
      eyebrow: "notes from readers",
      title: "Quietly *changing* things.",
      sub: "",
      ctaLabel: "More on Instagram",
    },
    fields: [text("eyebrow", "Eyebrow"), text("title", "Heading"), area("sub", "Paragraph"), text("ctaLabel", "Instagram link text")],
  },
  {
    type: "resell",
    label: "Resell band",
    glyph: "↗",
    hint: "Shown while resell licences are enabled.",
    defaults: {
      eyebrow: "resell rights · one year",
      title: "Sell these words. *Keep the money.*",
      text: "A one-time {price} licence lets you resell every {brand} ebook for a full year. Post it on your stories, your page, your reels — you keep 100% of what you charge. No monthly cuts, no permission calls.",
      items: [
        "All ebooks, sellable for 1 full year",
        "Your own reseller code + tracking link",
        "Keep 100% of your selling price",
        "Renew only if you want another year",
      ],
      badge: "one-time",
      priceNote: "You keep 100% of what you charge. Our licence fee is one-time.",
      fine: "Licence activates the moment your payment is verified.",
      primaryLabel: "Get resell rights",
      secondaryLabel: "Reseller login",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("text", "Paragraph", "{price}, {brand} and {count} are filled automatically."),
      { key: "items", label: "Bullet points", type: "lines" },
      text("badge", "Price badge"),
      text("priceNote", "Price card note"),
      text("fine", "Fine print"),
      text("primaryLabel", "Main button text"),
      text("secondaryLabel", "Second button text"),
    ],
  },
  {
    type: "promise",
    label: "Promise steps",
    glyph: "❋",
    hint: "Three steps for the refund promise.",
    defaults: {
      eyebrow: "the promise",
      title: "If it doesn't land, *we fix it.*",
      sub: "{refund_policy}",
      steps: [
        {
          step: "Step one",
          title: "Tell us what you actually wanted",
          text: "Use the support form or the refund page. One honest paragraph is enough.",
        },
        {
          step: "Step two",
          title: "We send material matched to it",
          text: "A different ebook, a focused note, or a custom guide built around your exact question.",
        },
        {
          step: "Step three",
          title: "Still not it? 100% back",
          text: "No debate, no store credit. If nothing lands, your money comes back.",
        },
      ],
      primaryLabel: "Ask for help",
      secondaryLabel: "Refund request",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      {
        key: "steps",
        label: "Steps",
        type: "items",
        itemFields: [
          { key: "step", label: "Label" },
          { key: "title", label: "Title" },
          { key: "text", label: "Text", type: "textarea" },
        ],
      },
      text("primaryLabel", "Support button text"),
      text("secondaryLabel", "Refund button text"),
    ],
  },
  {
    type: "faq",
    label: "FAQ",
    glyph: "?",
    hint: "Uses the FAQs from Site content.",
    defaults: {
      eyebrow: "before you ask",
      title: "Honest *answers.*",
      sub: "Still unsure? The support form goes straight to a human, not a bot.",
      ctaLabel: "Open support →",
    },
    fields: [text("eyebrow", "Eyebrow"), text("title", "Heading"), area("sub", "Paragraph"), text("ctaLabel", "Support link text")],
  },
  {
    type: "cta",
    label: "Closing CTA",
    glyph: "→",
    hint: "The last push before the footer.",
    defaults: {
      badge: "instant delivery",
      title: "One chai. *One shift.*",
      sub: "Pick the ebook that makes you slightly uncomfortable. That's usually the one.",
      primaryLabel: "Browse the library",
      primaryLink: "/ebooks",
      secondaryLabel: "@{insta}",
      secondaryLink: "",
      image: "",
    },
    fields: [
      text("badge", "Chip text"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      text("primaryLabel", "Main button text"),
      link("primaryLink", "Main button link"),
      text("secondaryLabel", "Second button text"),
      link("secondaryLink", "Second button link (blank = Instagram)"),
      image("image", "Background image"),
    ],
  },
  {
    type: "banner",
    label: "Image banner",
    glyph: "▭",
    hint: "A full-width promo banner with one button.",
    defaults: {
      eyebrow: "limited drop",
      title: "New ebook, *new rules.*",
      sub: "A short line about what is inside and who it is for.",
      image: "",
      ctaLabel: "Take a look",
      ctaLink: "/ebooks",
      align: "left",
      overlay: "soft",
      height: "normal",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      image("image", "Background image"),
      text("ctaLabel", "Button text"),
      link("ctaLink", "Button link"),
      select("align", "Text position", [
        ["left", "Left"],
        ["center", "Center"],
        ["right", "Right"],
      ]),
      select("overlay", "Overlay", [
        ["soft", "Soft dark"],
        ["none", "None"],
        ["cream", "Cream card"],
      ]),
      select("height", "Height", [
        ["normal", "Normal"],
        ["tall", "Tall"],
        ["compact", "Compact"],
      ]),
    ],
  },
  {
    type: "text",
    label: "Text section",
    glyph: "¶",
    hint: "Free text — about, story, announcement, anything.",
    defaults: {
      eyebrow: "",
      title: "A section with *your* words.",
      body: "Write anything here. Leave an empty line between paragraphs.\n\nWrap words in *asterisks* for italics and **double asterisks** for bold.",
      align: "left",
      width: "normal",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading (optional)"),
      { key: "body", label: "Body", type: "textarea", hint: "Blank line = new paragraph. Supports *italic* and **bold**." },
      select("align", "Text alignment", [
        ["left", "Left"],
        ["center", "Center"],
      ]),
      select("width", "Width", [
        ["normal", "Readable width"],
        ["wide", "Wide"],
      ]),
    ],
  },
  {
    type: "gallery",
    label: "Cover gallery",
    glyph: "▦",
    hint: "Every cover in one clean grid.",
    defaults: {
      eyebrow: "every cover",
      title: "The whole *library.*",
      sub: "",
      columns: 4,
      limit: 0,
      ctaLabel: "Browse all",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      { key: "columns", label: "Columns", type: "number" },
      { key: "limit", label: "Max covers (0 = all)", type: "number" },
      text("ctaLabel", "Link text"),
    ],
  },
  {
    type: "ticker",
    label: "Ticker strip",
    glyph: "⇢",
    hint: "A moving strip of short benefits or proof lines.",
    defaults: {
      items: ["instant delivery", "one-time price", "100% refund promise", "no subscription"],
      speed: "normal",
      tone: "ink",
    },
    fields: [
      { key: "items", label: "Lines", type: "lines", hint: "One short phrase per line." },
      select("speed", "Speed", [
        ["slow", "Slow"],
        ["normal", "Normal"],
        ["fast", "Fast"],
      ]),
      select("tone", "Tone", [
        ["ink", "Ink strip"],
        ["accent", "Accent strip"],
        ["outline", "Outlined"],
      ]),
    ],
  },
  {
    type: "countdown",
    label: "Offer countdown",
    glyph: "◷",
    hint: "A deadline band. Uses the countdown date from Look → announcement.",
    defaults: {
      eyebrow: "limited window",
      title: "This price is *not forever.*",
      sub: "Once the clock runs out the price goes back up. No extensions, no midnight emails.",
      ctaLabel: "See the library",
      ctaLink: "/ebooks",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      text("ctaLabel", "Button text"),
      link("ctaLink", "Button link"),
    ],
  },
  {
    type: "newsletter",
    label: "Email capture",
    glyph: "✉",
    hint: "Collect subscribers. They land in Admin → Growth.",
    defaults: {
      eyebrow: "the quiet list",
      title: "One letter. *One useful idea.*",
      sub: "New ebooks and the unspoken notes before they go public. No noise, unsubscribe in one click.",
      button: "Join the list",
      placeholder: "you@email.com",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      text("button", "Button text"),
      text("placeholder", "Input placeholder"),
    ],
  },
  {
    type: "bundles",
    label: "Bundle offers",
    glyph: "▣",
    hint: "Live bundles built in Admin → Growth.",
    defaults: {
      eyebrow: "stack and save",
      title: "Buy the *set*, not the single.",
      sub: "Hand-picked combinations at a price that makes the single look silly.",
      ctaLabel: "Browse every bundle",
    },
    fields: [text("eyebrow", "Eyebrow"), text("title", "Heading"), area("sub", "Paragraph"), text("ctaLabel", "Link text")],
  },
  {
    type: "journal",
    label: "Journal / blog",
    glyph: "✎",
    hint: "Latest published posts from Admin → Journal.",
    defaults: {
      eyebrow: "the journal",
      title: "Notes worth *stealing.*",
      sub: "Short essays on money, rooms and self-respect — the same voice as the ebooks.",
      limit: 3,
      ctaLabel: "Read the journal",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      area("sub", "Paragraph"),
      { key: "limit", label: "Max posts", type: "number" },
      text("ctaLabel", "Link text"),
    ],
  },
  {
    type: "split",
    label: "Image + text split",
    glyph: "◧",
    hint: "A tall image beside a short story and a button.",
    defaults: {
      eyebrow: "why this exists",
      title: "Written for the woman who is *done waiting.*",
      body: "Every ebook is short on purpose. You should be able to finish it on a commute and use one line before the day ends.\n\nNo padding. No recycled motivation. Just the specific part nobody says out loud.",
      image: "",
      imageSide: "left",
      items: ["Read in one sitting", "Use it the same day", "Yours forever"],
      ctaLabel: "Open the library",
      ctaLink: "/ebooks",
    },
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Heading"),
      { key: "body", label: "Body", type: "textarea", hint: "Blank line = new paragraph." },
      image("image", "Image"),
      select("imageSide", "Image side", [
        ["left", "Left"],
        ["right", "Right"],
      ]),
      { key: "items", label: "Bullet points", type: "lines" },
      text("ctaLabel", "Button text"),
      link("ctaLink", "Button link"),
    ],
  },
  {
    type: "proof",
    label: "Verified reviews",
    glyph: "✓",
    hint: "Real reviews from paid orders, approved in admin.",
    defaults: {
      eyebrow: "verified buyers",
      title: "Real people, *real receipts.*",
      sub: "Only buyers with a paid order can leave one of these.",
      limit: 6,
    },
    fields: [text("eyebrow", "Eyebrow"), text("title", "Heading"), area("sub", "Paragraph"), { key: "limit", label: "Max reviews", type: "number" }],
  },
  {
    type: "whatsapp",
    label: "WhatsApp band",
    glyph: "☎",
    hint: "A direct message band. Hidden when no number is set.",
    defaults: {
      eyebrow: "questions first?",
      title: "Message a human, not a *bot.*",
      sub: "Send one line about what you want to fix. You'll get a real answer, usually the same day.",
      button: "Chat on WhatsApp",
    },
    fields: [text("eyebrow", "Eyebrow"), text("title", "Heading"), area("sub", "Paragraph"), text("button", "Button text")],
  },
];

// Feature labels used by Admin → Growth.
export const FEATURE_LABELS = [
  ["search", "Live search", "Search bar and /search page with instant filtering."],
  ["wishlist", "Wishlist", "Hearts on every cover plus a saved list page."],
  ["recent", "Recently viewed", "A quiet row of the books this visitor opened."],
  ["coupons", "Coupon codes", "Discount codes validated on the server at checkout."],
  ["bundles", "Bundles", "Multi-ebook offers at a set price."],
  ["samples", "Free samples", "A read-a-sample panel on every product page."],
  ["reviews", "Verified reviews", "Paid buyers can leave reviews; you approve them."],
  ["journal", "Journal / blog", "Public posts at /journal for search traffic."],
  ["newsletter", "Newsletter", "Footer + section capture, list and CSV export."],
  ["assistant", "AI shop assistant", "A chat widget that answers from your catalogue."],
  ["whatsappFloat", "WhatsApp button", "Floating chat button using the number in Site content."],
  ["socialProof", "Social proof toasts", "Recent real purchases shown quietly."],
  ["exitIntent", "Exit-offer popup", "One last coupon offer when a visitor moves to leave."],
  ["countdown", "Offer countdown", "Countdown clock in the announcement and countdown section."],
  ["share", "Share buttons", "WhatsApp + copy-link sharing on product pages."],
  ["receipts", "PDF receipts", "Paid buyers can download a receipt."],
  ["stickyBuy", "Sticky buy bar", "Price and buy button that follows the scroll."],
  ["trustBadges", "Trust badges", "Refund / no-subscription / licence reassurance."],
  ["upsell", "Order upsell", "Suggests the next ebook after a paid order."],
  ["orderTrack", "Order tracking", "The /track lookup page."],
];

export const BLOCK_MAP = Object.fromEntries(BLOCK_TYPES.map((entry) => [entry.type, entry]));

export function newBlock(type) {
  const spec = BLOCK_MAP[type] || BLOCK_MAP.text;
  return {
    ...JSON.parse(JSON.stringify(spec.defaults)),
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    hidden: false,
  };
}

export const DEFAULT_BLOCKS = [
  newBlock("hero"),
  newBlock("stats"),
  newBlock("library"),
  newBlock("value"),
  newBlock("quote"),
  newBlock("testimonials"),
  newBlock("resell"),
  newBlock("promise"),
  newBlock("faq"),
  newBlock("cta"),
];

/* -------------------------------- helpers -------------------------------- */

export function blockLabel(block) {
  const spec = BLOCK_MAP[block?.type];
  const heading = block?.title || block?.eyebrow || "";
  return {
    label: spec?.label || "Section",
    glyph: spec?.glyph || "◻",
    heading: String(heading).replace(/\*/g, "").slice(0, 70),
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function asObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Reads the three builder settings out of a site/admin payload, falling back to
// the defaults above for anything that has not been saved yet.
export function readKit(source = {}) {
  // The site payload is null on the very first render (before /api/site lands), so
  // every read must tolerate null instead of assuming an object.
  const safe = source && typeof source === "object" ? source : {};
  const settings = safe.settings || {};
  const savedBlocks = asArray(safe.blocks) || asArray(settings.site_blocks);
  const savedContent = asObject(safe.content) || asObject(settings.site_content) || {};
  const savedTheme = asObject(safe.theme) || asObject(settings.site_theme) || {};

  const blocks = (savedBlocks && savedBlocks.length ? savedBlocks : DEFAULT_BLOCKS).map((block, index) => ({
    hidden: false,
    ...block,
    id: block.id || `${block.type || "block"}-${index}`,
  }));

  return {
    blocks,
    content: { ...DEFAULT_CONTENT, ...savedContent },
    theme: { ...DEFAULT_THEME, ...savedTheme },
    shape: SHAPES.find((entry) => entry.id === savedTheme.shape) || SHAPES[0],
    font: FONTS.find((entry) => entry.id === savedTheme.font) || FONTS[0],
  };
}

// {price} {brand} {insta} {count} {year} tokens inside any builder label.
export function fillTokens(value, tokens = {}) {
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => (tokens[key] !== undefined ? tokens[key] : match));
}

export function plainText(value) {
  return String(value || "").replace(/\*/g, "");
}
