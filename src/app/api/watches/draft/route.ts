import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { readPage, type PageData } from "@/lib/page";
import { agentHeaders } from "@/lib/manners";
import { draftWatch, AiError } from "@/lib/ai";
import { fail, storePath } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl, canonicalProductUrl } from "@/lib/safeFetch";
import { rememberDraft } from "@/lib/draftCache";

// Step 1 of a new watch: read the page once, lock onto the item, and turn the owner's words into a checklist.
// Works with the demo stores and with real store pages (watch-and-alert only).
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { url, wants } = await req.json();
  if (!String(wants ?? "").trim()) return fail("Tell Standby what you want, in your own words.");

  try {
    let page: PageData;
    const demo = storePath(String(url ?? ""));
    if (demo) {
      page = await readPage(demo, agentHeaders(null));
      const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
      if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo. Use the links on this page.");
    } else {
      // Use the product's own address (not the longer category-listing one some stores ask bots to avoid).
      const real = await assertPublicUrl(canonicalProductUrl(String(url ?? "")));
      page = await readPage(real.toString(), agentHeaders(null));
    }
    // Only shopping pages that take PayPal: a real store, a real price, and a payment method with buyer protection.
    if (!page.acceptsPayPal) {
      return fail("Standby only watches shopping pages that accept PayPal, and this page doesn't show PayPal as a way to pay.");
    }
    rememberDraft(owner.id, page);
    // Sizes and colours are stable choices you can tick. Resale ticket listings come and go, so those aren't pickable.
    const pickable = page.kind !== "TICKET";
    const options = page.offers.map((o) => ({ id: o.id, name: o.name, priceCents: o.priceCents, inStock: o.inStock, seller: o.seller }));
    const draft = await draftWatch({
      wants: String(wants),
      pageText: page.text,
      options: pickable ? options.map((o) => ({ id: o.id, name: o.name, price: `$${(o.priceCents / 100).toFixed(2)}`, inStock: o.inStock })) : [],
      today: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({
      draft,
      item: {
        url: page.url,
        listingId: page.listingId,
        name: page.name,
        kind: page.kind,
        store: page.storeName,
        storeSeller: page.isDemo && page.storeName === "Wren" ? "Wren" : null,
        isDemo: page.isDemo,
        // Only stores that accept AI buyers can be paid automatically. Real stores today: watch and alert.
        acceptsAiBuyers: page.isDemo,
        options: page.offers.length,
        inStock: page.offers.filter((o) => o.inStock).length,
        pickable,
        choices: pickable ? options : [],
        priceRange: page.offers.length
          ? [Math.min(...page.offers.map((o) => o.priceCents)), Math.max(...page.offers.map((o) => o.priceCents))]
          : null,
      },
    });
  } catch (e) {
    return fail(e instanceof AiError || e instanceof Error ? e.message : "Couldn't read that page.");
  }
}
