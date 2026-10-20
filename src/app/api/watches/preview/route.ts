import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { readPage, type PageData } from "@/lib/page";
import { agentHeaders } from "@/lib/manners";
import { fail, storePath } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl, canonicalProductUrl } from "@/lib/safeFetch";
import { rememberDraft } from "@/lib/draftCache";
import { extract, optionLabel, splitOption } from "@/lib/extract";
import { aiCheckoutFor, type AiCheckout } from "@/lib/ucp";

// A quick look at a pasted link, with no AI: what product it is, its photo, price and stock, and whether it takes PayPal.
// For a real store, also whether it publishes an AI-checkout profile (information only: real stores stay alert-only).
// The page read is kept, so making the checklist next doesn't visit the store again.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { url } = await req.json();
  try {
    let page: PageData;
    let aiCheckout: AiCheckout | null = null;
    const demo = storePath(String(url ?? ""));
    if (demo) {
      page = await readPage(demo, agentHeaders(null));
      const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
      if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo. Use the links on this page.");
    } else {
      const real = await assertPublicUrl(canonicalProductUrl(String(url ?? "")));
      [page, aiCheckout] = await Promise.all([readPage(real.toString(), agentHeaders(null)), aiCheckoutFor(real.toString())]);
    }
    rememberDraft(owner.id, page);
    const prices = page.offers.map((o) => o.priceCents);
    const inStock = page.offers.filter((o) => o.inStock).length;
    return NextResponse.json({
      url: page.url,
      name: page.name,
      store: page.storeName,
      isDemo: page.isDemo,
      kind: page.kind,
      image: page.image,
      options: page.offers.length,
      inStock,
      priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : null,
      acceptsPayPal: page.acceptsPayPal,
      aiCheckout,
      extracted: extract(page),
      suggestions: suggest(page),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read that page.");
  }
}

const whole = (cents: number) => `$${Math.floor(cents / 100)}`;

// What Scout offers to watch for on this page, built from what's actually on it.
// "{time}" is filled in by the browser, in your own time zone.
function suggest(page: PageData): { title: string; sentence: string }[] {
  const canBuy = page.isDemo; // Demo stores accept AI buyers; real stores: Scout tells you.
  const out: { title: string; sentence: string }[] = [];
  if (!page.offers.length) return out;
  const cheapest = Math.min(...page.offers.map((o) => o.priceCents));

  if (page.kind === "TICKET") {
    const dip = whole(cheapest * 0.8);
    out.push({ title: `A flash dip under ${dip}`, sentence: `Buy one ticket the moment any seat drops under ${dip} including fees. Just one.` });
    const section = page.offers.map((o) => o.name.match(/Section\s+(\w+)/i)?.[1]).find(Boolean);
    if (section) out.push({ title: `A seat in Section ${section}`, sentence: `Buy one ticket in Section ${section} under ${whole(cheapest * 0.9)} including fees. Just one.` });
    out.push({ title: "Two seats together", sentence: `Buy 2 seats next to each other in the same row, under ${whole(cheapest * 0.9)} each including fees.` });
    out.push({ title: "When sales open", sentence: `At {time}, start checking and buy one ticket under ${whole(cheapest)} including fees.` });
    return out;
  }

  // One colour on the page? Then the size alone says it ("size 11", not "Mushroom (Mushroom Sole), size 11").
  const oneColour = new Set(page.offers.map((o) => splitOption(optionLabel(page, o.name)).colour)).size <= 1;
  const phrase = (name: string) => {
    const { colour: c, size } = splitOption(optionLabel(page, name));
    const colour = oneColour && size ? "" : c;
    return size ? (colour ? `${colour}, size ${size}` : `size ${size}`) : colour || name;
  };
  for (const o of page.offers.filter((o) => !o.inStock).slice(0, 3)) {
    const p = phrase(o.name);
    out.push({
      title: `${p.charAt(0).toUpperCase()}${p.slice(1)} back in stock`,
      sentence: canBuy
        ? `Buy ${page.name} in ${p} the moment it's back in stock. Most I'll pay: ${whole(o.priceCents)} plus any shipping or fees. Just one.`
        : `Tell me the moment ${page.name} in ${p} is back in stock, at ${whole(o.priceCents)} or less.`,
    });
  }
  const example = page.offers.find((o) => o.inStock) ?? page.offers[0];
  const pick = page.offers.length > 1 ? ` in ${phrase(example.name)}` : "";
  const target = whole(cheapest * 0.85);
  out.push({
    title: `A price drop to ${target}`,
    sentence: canBuy ? `Buy ${page.name}${pick} when the price drops to ${target} or less. Just one.` : `Tell me when ${page.name}${pick} drops to ${target} or less.`,
  });
  out.push({
    title: "At a set time",
    sentence: canBuy
      ? `At {time}, buy ${page.name}${pick} the moment it's on sale. Most I'll pay: ${whole(example.priceCents)} plus any shipping or fees. Just one.`
      : `At {time}, check ${page.name}${pick} and tell me if it's on sale for ${whole(example.priceCents)} or less.`,
  });
  return out;
}
