import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { readPage, type PageData } from "@/lib/page";
import { agentHeaders } from "@/lib/manners";
import { draftWatch, AiError } from "@/lib/ai";
import { fail, storePath } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl, canonicalProductUrl } from "@/lib/safeFetch";
import { recallDraft, rememberDraft } from "@/lib/draftCache";
import { cleanLocks, meetsLocks, pageFields } from "@/lib/extract";

// Step 1 of a new watch: read the page once, lock onto the item, and turn the owner's words into a checklist.
// Works with the demo stores and with real store pages (watch-and-alert only).
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { url, wants, optionIds, now, tzOffset } = await req.json();
  if (!String(wants ?? "").trim()) return fail("Tell Standby what you want, in your own words.");

  try {
    let page: PageData;
    const demo = storePath(String(url ?? ""));
    if (demo) {
      // Reuse the preview's read if it's fresh, so the store isn't visited twice.
      page = recallDraft(owner.id, demo, 5 * 60_000) ?? (await readPage(demo, agentHeaders(null)));
      const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
      if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo. Use the links on this page.");
    } else {
      // Use the product's own address (not the longer category-listing one some stores ask bots to avoid).
      const real = await assertPublicUrl(canonicalProductUrl(String(url ?? "")));
      page = recallDraft(owner.id, real.toString(), 5 * 60_000) ?? (await readPage(real.toString(), agentHeaders(null)));
    }
    // Only shopping pages that take PayPal: a real store, a real price, and a payment method with buyer protection.
    if (!page.acceptsPayPal) {
      return fail("Standby only watches shopping pages that accept PayPal, and this page doesn't show PayPal as a way to pay.");
    }
    rememberDraft(owner.id, page);
    // Sizes and colours are stable choices you can tick. Resale ticket listings come and go, so those aren't pickable.
    const pickable = page.kind !== "TICKET";
    const options = page.offers.map((o) => ({ id: o.id, name: o.name, priceCents: o.priceCents, inStock: o.inStock, seller: o.seller }));
    // Options you tapped on the preview are your choice; the AI doesn't get to change them.
    const tapped = pickable && Array.isArray(optionIds) ? options.filter((o) => optionIds.includes(o.id)) : [];
    const draft = await draftWatch({
      wants: String(wants),
      pageText: page.text,
      options: pickable ? options.map((o) => ({ id: o.id, name: o.name, price: `$${(o.priceCents / 100).toFixed(2)}`, inStock: o.inStock })) : [],
      ticked: tapped.map((o) => o.name),
      fields: pageFields(page),
      now: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(now)) ? String(now) : new Date().toISOString().slice(0, 16) + " UTC",
    });
    if (tapped.length) draft.matchingOptionIds = tapped.map((o) => o.id);
    // A start time is when to begin watching, not something the item has to match.
    if (draft.startAt) draft.mustHave = draft.mustHave.filter((m) => !/^(start|begin|starting|watch from|from \d)/i.test(m.text.trim()));
    // Details you required (a section, a row, a seller, a size...), held in code, on whatever details this site shows.
    const locks = cleanLocks(page, draft.locks);
    const notBefore = startMoment(draft.startAt, Number(tzOffset) || 0);
    // If the AI missed a price you wrote ("drops to $22"), take the lowest $ amount from your words.
    if (draft.maxTotalUsd == null) {
      const amounts = [...String(wants).matchAll(/\$\s?(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1])).filter((n) => n > 0);
      if (amounts.length) draft.maxTotalUsd = Math.min(...amounts) * (draft.quantity ?? 1);
    }

    const qty = draft.quantity ?? 1;
    // If your words talk about a price (a $ amount, a drop, a sale), "available now" needs a budget you actually gave.
    const priceTalk = /\$|\d+\s*(dollars|usd)|drop|lower|cheaper|sale|discount|deal|dip|under|less|budget|price/i.test(String(wants));
    const budgetFromYou = draft.maxTotalUsd != null;

    // What it costs today, all in: the price plus any fee or shipping the store charges (the demo stores list theirs;
    // real stores' product data doesn't, so it's the price only). Used to suggest your budget when you didn't name one.
    const fees = page.isDemo
      ? new Map((await prisma.offer.findMany({ where: { listingId: page.listingId }, select: { id: true, feeCents: true } })).map((o) => [o.id, o.feeCents]))
      : new Map<string, number>();
    const totalOf = (o: (typeof page.offers)[number]) => (o.priceCents + (fees.get(o.id) ?? 0)) * qty;
    const matched = page.offers.filter((o) => draft.matchingOptionIds.includes(o.id));
    const basis = matched.length
      ? matched.reduce((a, b) => (totalOf(b) > totalOf(a) ? b : a))
      : page.offers.length
        ? page.offers.reduce((a, b) => (totalOf(b) < totalOf(a) ? b : a))
        : null;
    const today = basis
      ? { totalCents: totalOf(basis), priceCents: basis.priceCents * qty, feeCents: (fees.get(basis.id) ?? 0) * qty, feesKnown: page.isDemo, label: basis.name }
      : null;
    if (!budgetFromYou && today) draft.maxTotalUsd = today.totalCents / 100;

    // Is what you asked for on sale right now, inside your budget? Then there's nothing to wait for:
    // Standby is for what you can't get yet, so it points you to the store instead of starting a watch.
    const availableNow =
      pickable && !notBefore && !(priceTalk && !budgetFromYou)
        ? matched
            .filter((o) => o.inStock && meetsLocks(page, o, locks).ok && (draft.maxTotalUsd == null || totalOf(o) / 100 <= draft.maxTotalUsd))
            .map((o) => ({ name: o.name, priceCents: totalOf(o), url: o.url ?? page.url }))
        : [];
    return NextResponse.json({
      draft,
      notBefore,
      locks,
      availableNow,
      today,
      budgetSuggested: !budgetFromYou && !!today,
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

// "2026-10-23T09:00" in the owner's time zone → a moment, if it's in the next 28 days.
function startMoment(local: string | null, tzOffsetMinutes: number): string | null {
  const m = local?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + tzOffsetMinutes * 60_000;
  return at > Date.now() && at < Date.now() + 28 * 86_400_000 ? new Date(at).toISOString() : null;
}
