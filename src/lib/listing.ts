import { prisma } from "./prisma";
import type { DressDetails, TicketDetails } from "./stores";

export async function loadListing(id: string) {
  const listing = await prisma.listing.findUnique({ where: { id }, include: { offers: { orderBy: { priceCents: "asc" } } } });
  if (!listing) return null;
  const offers = listing.offers.map((o) => ({ ...o, attrs: JSON.parse(o.attrs) as Record<string, string> }));
  return { ...listing, offers };
}

export type LoadedListing = NonNullable<Awaited<ReturnType<typeof loadListing>>>;

export function ticketDetails(l: LoadedListing) {
  return JSON.parse(l.details) as TicketDetails;
}

export function dressDetails(l: LoadedListing) {
  return JSON.parse(l.details) as DressDetails;
}

// schema.org product data, the same kind real stores publish for search engines and shopping agents.
export function jsonLd(l: LoadedListing) {
  const offers = l.offers.map((o) => ({
    "@type": "Offer",
    identifier: o.id,
    sku: o.ref,
    name: o.label,
    price: (o.priceCents / 100).toFixed(2),
    priceCurrency: "USD",
    availability: o.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    seller: { "@type": "Organization", name: o.seller },
  }));
  if (l.kind === "TICKET") {
    const d = ticketDetails(l);
    return {
      "@context": "https://schema.org",
      "@type": "Event",
      identifier: l.id,
      name: l.name,
      startDate: `${d.date}T20:00:00+00:00`,
      location: { "@type": "Place", name: d.venue, address: d.city },
      offers,
    };
  }
  const d = dressDetails(l);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    identifier: l.id,
    name: l.name,
    brand: { "@type": "Brand", name: d.brand },
    offers,
  };
}
