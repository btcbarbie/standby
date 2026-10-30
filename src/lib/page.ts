// Reads a store page over HTTP, the way an agent reads any website:
// the page's machine-readable product data (schema.org JSON-LD) plus all of its text.
// Hidden text is included on purpose: that's what a real scraper sees, and where tricks hide.

export type PageOffer = {
  id: string; // the store's own offer id (demo checkout id, or a real store's SKU / variant URL)
  ref: string; // public reference shown on the page
  name: string;
  priceCents: number;
  inStock: boolean;
  seller: string;
  url?: string; // where a person can buy it (real stores)
};

export type PageData = {
  url: string;
  listingId: string;
  kind: "TICKET" | "DRESS" | "ITEM";
  name: string;
  offers: PageOffer[];
  text: string;
  isDemo: boolean;
  storeName: string;
  // Does the page offer PayPal as a way to pay? Standby only takes on stores that do.
  acceptsPayPal: boolean;
  // The product photo, for previews. Only https links; null if the page has none.
  image: string | null;
  // Other versions of this product the page links to (usually other colours), each its own page.
  siblings: { url: string; label: string }[];
  // This page's own colour, read from its address when the store gives each colour its own page.
  thisColour: string | null;
};

// Other colours usually live on their own product pages with a similar address
// (".../womens-runner-nz-slip-on-mushroom" → "...-dark-navy"). Stores mention them on the page for their colour swatches.
const titleCase = (words: string[]) => words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const SEASON = /^(ss|aw|fw|sp|su|fa)\d{2}$/i;

function siblingPages(html: string, pageUrl: string): { siblings: { url: string; label: string }[]; thisColour: string | null } {
  const none = { siblings: [], thisColour: null };
  const u = new URL(pageUrl);
  const m = u.pathname.match(/^(.*\/products\/)([a-z0-9-]+)\/?$/i);
  if (!m) return none;
  const [, base, handle] = m;
  const words = handle.split("-");
  // Closest match first ("mens-tree-runners" → "mens-tree-runners-jet-black"), never fewer than three words in common.
  for (let cut = 0; cut <= 3 && words.length - cut >= 3; cut++) {
    const prefix = words.slice(0, words.length - cut).join("-");
    const found = [...new Set(html.match(new RegExp(`\\b${prefix}-[a-z0-9-]+`, "gi")) ?? [])]
      .map((h) => h.toLowerCase())
      .filter((h) => h !== handle && !h.endsWith("-") && h.length < 120);
    if (found.length) {
      const known = new Set(words);
      const own = words.slice(words.length - cut).filter((w) => !SEASON.test(w));
      const siblings = found
        .map((h) => {
          const rest = h.slice(prefix.length + 1).split("-").filter((w) => !known.has(w) && !SEASON.test(w));
          return { url: `${u.origin}${base}${h}`, label: titleCase(rest) };
        })
        .filter((s, i, all) => s.label && all.findIndex((x) => x.label === s.label) === i)
        .slice(0, 10);
      return { siblings, thisColour: own.length ? titleCase(own) : null };
    }
  }
  return none;
}

function mentionsPayPal(html: string) {
  return /paypal/i.test(html);
}

// Product photo: the store's own product data first, then the page's share image.
function pickImage(candidate: unknown, html: string, pageUrl: string): string | null {
  const first = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return first(v[0]);
    if (typeof v === "object") return first((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl);
    return null;
  };
  const raw = first(candidate) ?? html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/&amp;/g, "&"), pageUrl);
    if (u.protocol === "http:") u.protocol = "https:";
    // Store image servers (like Shopify's) often hand out a thumbnail; ask for a sharper one.
    const w = Number(u.searchParams.get("width"));
    if (w && w < 600) u.searchParams.set("width", "600");
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// Store pages are served by this same app, so the agent reads them over the local network.
export function internalBase() {
  return process.env.INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3300}`;
}

export function isDemoPath(url: string) {
  return url.startsWith("/store/");
}

// Thrown when the store says "too many requests" or "come back later". The agent waits instead of retrying.
export class BackoffError extends Error {
  seconds: number;
  constructor(seconds: number) {
    super(`The store asked agents to wait ${seconds}s.`);
    this.seconds = seconds;
  }
}

export async function readPage(url: string, headers: Record<string, string>): Promise<PageData> {
  // Every visit is signed (Web Bot Auth), so a store can verify it really is Standby.
  const { signedHeaders } = await import("./agentKey");
  if (isDemoPath(url)) {
    const absolute = `${internalBase()}${url}`;
    const res = await fetch(absolute, { cache: "no-store", headers: await signedHeaders(absolute, headers) });
    if (res.status === 429 || res.status === 503) throw new BackoffError(retrySeconds(res.headers.get("retry-after")));
    if (!res.ok) throw new Error(`The page didn't load (${res.status}).`);
    return parseDemoPage(url, await res.text());
  }

  const { fetchPublic, robotsAllows, RobotsBlocked, SiteError } = await import("./safeFetch");
  const store = new URL(url).hostname.replace(/^www\./, "");
  if (!(await robotsAllows(url)))
    throw new RobotsBlocked(
      `${store} is a shopping site, but its rules for bots (robots.txt) don't allow automated visitors on this link, so Scout can't watch or buy it. If this is a search or category link, try the product's own page.`,
    );
  const res = await fetchPublic(url, { ...(await signedHeaders(url, headers)), Accept: "text/html" });
  if (res.status === 429 || res.status === 503) throw new BackoffError(retrySeconds(res.retryAfter));
  if (res.status === 401 || res.status === 403)
    throw new SiteError(`${store} turns bots away (it refused Scout's visit with a ${res.status}). It doesn't allow automated watchers or buyers, so Scout can't use it.`);
  if (res.status === 404 || res.status === 410) throw new SiteError(`${store} says this page doesn't exist (${res.status}). Check the link, or open the product again and copy its address.`);
  if (res.status !== 200) throw new SiteError(`${store} didn't load the page (${res.status}). Try again in a minute.`);
  // Some stores answer automated visitors with a bot check (a script and nothing else) instead of the page.
  // Standby doesn't try to get past those: it says who it is and respects the store's choice.
  const visible = res.text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const title = res.text.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "";
  const botWall =
    /robot or human|are you a (robot|human)|verify (that )?you are (a )?human|captcha|access denied|unusual traffic|just a moment|attention required|pardon our interruption|request (was )?blocked|bot detection/i;
  if ((!title && visible.length < 200 && /<script/i.test(res.text)) || botWall.test(title) || (visible.length < 3000 && botWall.test(visible))) {
    throw new SiteError(
      `${store} is a shopping site, but it doesn't allow bots: it answers automated visitors with a bot check instead of the page. Scout can't watch or buy here, and Standby doesn't get around those checks.`,
    );
  }
  return parseRealPage(url, res.text);
}

function retrySeconds(header: string | null) {
  const after = parseInt(header ?? "", 10);
  return Number.isFinite(after) && after > 0 ? Math.min(after, 3600) : 120;
}

// ---------- Demo stores ----------

export function parseDemoPage(url: string, html: string): PageData {
  const m = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("This page has no product data the agent can lock onto.");
  const ld = JSON.parse(m[1]);
  type LdOffer = { identifier: string; sku: string; name: string; price: string; availability: string; seller?: { name?: string } };
  const offers: PageOffer[] = ((ld.offers ?? []) as LdOffer[]).map((o) => ({
    id: o.identifier,
    ref: o.sku,
    name: o.name,
    priceCents: Math.round(parseFloat(o.price) * 100),
    inStock: o.availability.endsWith("InStock"),
    seller: o.seller?.name ?? "",
  }));
  return {
    url,
    listingId: ld.identifier,
    kind: ld["@type"] === "Event" ? "TICKET" : "DRESS",
    name: ld.name,
    offers,
    text: htmlToText(html),
    isDemo: true,
    storeName: url.includes("/tixora/") ? "Tixora" : "Wren",
    acceptsPayPal: mentionsPayPal(html),
    image: null,
    siblings: [],
    thisColour: null,
  };
}

// ---------- Real stores: schema.org Product / ProductGroup data, as most shops publish for search engines ----------

type Ld = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function hasType(node: Ld, ...types: string[]) {
  return asArray(node["@type"] as string | string[]).some((t) => types.includes(String(t)));
}

function decode(s: unknown) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function nameOf(v: unknown) {
  return typeof v === "string" ? v : v && typeof v === "object" ? decode((v as Ld).name) : "";
}

export function parseRealPage(url: string, html: string): PageData {
  const nodes: Ld[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      for (const n of asArray(JSON.parse(m[1].trim()) as Ld | Ld[])) {
        nodes.push(n);
        for (const g of asArray(n["@graph"] as Ld[])) nodes.push(g);
      }
    } catch {
      // Ignore malformed blocks; many pages have one.
    }
  }
  const product = nodes.find((n) => hasType(n, "ProductGroup")) ?? nodes.find((n) => hasType(n, "Product"));
  if (!product) {
    // Some sites (often ticketing and creator platforms) build the whole page in your browser with code and publish
    // no product data, so an honest reader gets an almost empty page: no items, prices or stock to check.
    const visible = html.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (visible.length < 300 && /<script/i.test(html)) {
      const host = new URL(url).hostname.replace(/^www\./, "");
      throw new Error(
        `${host} builds this page with code in your browser and doesn't publish its product details (items, prices, stock) for automated readers, so Scout can't see what's on sale.${/paypal/i.test(html) ? "" : " It also doesn't show PayPal as a way to pay."} It isn't your link: this site can't be watched yet.`,
      );
    }
    // A store's search, ad or category page still looks like a shop; anything else (a blog, news, Wikipedia) isn't one.
    const shop = /add to (cart|bag|basket)|checkout|shopping (cart|bag)|og:type["']?\s+content=["']?product|"@type"\s*:\s*"(Offer|ItemList)"/i.test(html);
    throw new Error(
      shop
        ? "This is a shopping site, but this link isn't one product's page (it looks like a search, ad or category page). Open the product itself and copy that page's link."
        : "This isn't a shopping page. Scout only watches pages where you can buy something, like one product or one event's tickets.",
    );
  }

  const host = new URL(url).hostname.replace(/^www\./, "");
  const brand = nameOf(product.brand) || host;
  const offers: PageOffer[] = [];
  const addOffers = (source: Ld, baseLabel: string, sku: string) => {
    // Some stores keep size and colour in their own fields rather than in the variant's name.
    // Short values like "M" need a whole-word match ("Shorts" isn't size S); longer ones just need to appear.
    const already = (v: string) =>
      v.length <= 3
        ? new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(decode(baseLabel))
        : decode(baseLabel).toLowerCase().includes(v.toLowerCase());
    const extras = [
      source.color && !already(decode(source.color)) && `Colour ${decode(source.color)}`,
      source.size && !already(decode(source.size)) && `Size ${decode(source.size).toUpperCase()}`,
    ].filter(Boolean);
    const label = [decode(baseLabel), ...extras].join(" - ");
    const unique = String(source.mpn ?? source.gtin ?? source.gtin13 ?? source.gtin14 ?? "");
    for (const o of asArray(source.offers as Ld | Ld[])) {
      const price = parseFloat(String(o.price ?? o.lowPrice ?? ""));
      if (!Number.isFinite(price)) continue;
      const offerUrl = o.url ? new URL(String(o.url), url).toString() : String(source.url ?? url);
      const id = String(unique || o.sku || sku || offerUrl || label) || label;
      offers.push({
        id,
        ref: String(unique || o.sku || sku || "") || id.slice(-12),
        name: decode(label),
        priceCents: Math.round(price * 100),
        inStock: String(o.availability ?? "InStock").includes("InStock"),
        seller: nameOf(o.seller) || brand,
        url: offerUrl.startsWith("http") ? offerUrl : url,
      });
    }
  };
  const variants = asArray(product.hasVariant as Ld[]);
  if (variants.length) {
    for (const v of variants.slice(0, 120)) addOffers(v, String(v.name ?? product.name), String(v.sku ?? ""));
  } else {
    addOffers(product, String(product.name), String(product.sku ?? ""));
  }
  if (offers.length === 0) throw new Error("This page shows a product but no price Standby can read.");

  const name = decode(product.name);
  const idPart = String(product.productGroupID ?? product.productID ?? product.sku ?? new URL(url).pathname);
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const description = decode(product.description).slice(0, 400);
  const summary = [
    `Store: ${host}`,
    `Page title: ${title}`,
    `Product: ${name} (brand: ${brand})`,
    description && `Description: ${description}`,
    `Options listed in the page's product data (${offers.length}):`,
    ...offers.map((o) => `- ${o.name} · ${(o.priceCents / 100).toFixed(2)} · ${o.inStock ? "in stock" : "sold out"} · seller ${o.seller}${o.ref ? ` · ref ${o.ref}` : ""}`),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    url,
    listingId: `ext:${host}:${idPart}`,
    kind: "ITEM",
    name,
    offers,
    // The product data first, then an excerpt of what a person would read on the page.
    text: `${summary}\n\n--- Page text (excerpt) ---\n${htmlToText(html).slice(0, 6000)}`,
    isDemo: false,
    storeName: host,
    acceptsPayPal: mentionsPayPal(html),
    image: pickImage(product.image ?? variants[0]?.image, html, url),
    ...siblingPages(html, url),
  };
}

function htmlToText(html: string) {
  const body = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? html.match(/<body[\s\S]*<\/body>/)?.[0] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<(svg|noscript|template)[\s\S]*?<\/\1>/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section)[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 12000);
}
