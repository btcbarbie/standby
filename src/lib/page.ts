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
};

function mentionsPayPal(html: string) {
  return /paypal/i.test(html);
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
  if (!(await robotsAllows(url))) throw new RobotsBlocked("This store's robots.txt asks automated agents not to visit this page.");
  const res = await fetchPublic(url, { ...(await signedHeaders(url, headers)), Accept: "text/html" });
  if (res.status === 429 || res.status === 503) throw new BackoffError(retrySeconds(res.retryAfter));
  if (res.status === 401 || res.status === 403) throw new SiteError(`The store turned the visit away (${res.status}). Some stores block automated visitors.`);
  if (res.status !== 200) throw new SiteError(`The page didn't load (${res.status}).`);
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
  if (!product) throw new Error("This page has no product data Standby can lock onto. Try a single product's page.");

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
