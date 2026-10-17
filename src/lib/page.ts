// Reads a store page over HTTP, the way an agent reads any website:
// the page's machine-readable product data (schema.org JSON-LD) plus all of its text.
// Hidden text is included on purpose: that's what a real scraper sees, and where tricks hide.

export type PageOffer = {
  id: string; // the store's own offer id (used for checkout)
  ref: string; // public reference shown on the page
  name: string;
  priceCents: number;
  inStock: boolean;
  seller: string;
};

export type PageData = {
  url: string;
  listingId: string;
  kind: "TICKET" | "DRESS";
  name: string;
  offers: PageOffer[];
  text: string;
};

// Store pages are served by this same app, so the agent reads them over the local network.
export function internalBase() {
  return process.env.INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3300}`;
}

export async function readPage(url: string): Promise<PageData> {
  const absolute = url.startsWith("http") ? url : `${internalBase()}${url}`;
  const res = await fetch(absolute, { cache: "no-store", headers: { "User-Agent": "StandbyAgent/1.0" } });
  if (!res.ok) throw new Error(`The page didn't load (${res.status}).`);
  const html = await res.text();
  return parsePage(url, html);
}

export function parsePage(url: string, html: string): PageData {
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
  };
}

function htmlToText(html: string) {
  const body = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
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
