import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { readPage, type PageData } from "@/lib/page";
import { agentHeaders } from "@/lib/manners";
import { fail, storePath } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl, canonicalProductUrl } from "@/lib/safeFetch";
import { rememberDraft } from "@/lib/draftCache";

// A quick look at a pasted link, with no AI: what product it is, its photo, price and stock, and whether it takes PayPal.
// The page read is kept, so making the checklist next doesn't visit the store again.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { url } = await req.json();
  try {
    let page: PageData;
    const demo = storePath(String(url ?? ""));
    if (demo) {
      page = await readPage(demo, agentHeaders(null));
      const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
      if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo. Use the links on this page.");
    } else {
      const real = await assertPublicUrl(canonicalProductUrl(String(url ?? "")));
      page = await readPage(real.toString(), agentHeaders(null));
    }
    rememberDraft(owner.id, page);
    const prices = page.offers.map((o) => o.priceCents);
    return NextResponse.json({
      url: page.url,
      name: page.name,
      store: page.storeName,
      isDemo: page.isDemo,
      kind: page.kind,
      image: page.image,
      options: page.offers.length,
      inStock: page.offers.filter((o) => o.inStock).length,
      priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : null,
      acceptsPayPal: page.acceptsPayPal,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read that page.");
  }
}
