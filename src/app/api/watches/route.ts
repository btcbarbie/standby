import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { DEMO_MAX_VISITS, DEMO_PACE_SEC, REAL_MAX_VISITS, REAL_PACE_SEC } from "@/lib/manners";
import { prisma } from "@/lib/prisma";
import { paypalConfigured } from "@/lib/paypal";
import { startHold } from "@/lib/holds";
import { fail, publicOrigin, storePath } from "@/lib/http";
import { recallDraft } from "@/lib/draftCache";

// Step 2: the owner confirms the checklist and picks a mode.
//   ALERT: Standby watches and tells you when it matches; you pay. No PayPal needed to start.
//   BUY:   you approve a PayPal hold now, and Standby pays as soon as every check passes (stores that accept AI buyers only).
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const body = await req.json();

  const demoPath = storePath(String(body.url ?? ""));
  const url = demoPath ?? String(body.url ?? "");
  // The item is locked from the page Standby read while drafting, never from what the browser sends back.
  const page = recallDraft(owner.id, url);
  if (!page) return fail("Please draft the checklist again; the page read has expired.");

  const mode = body.mode === "BUY" ? "BUY" : "ALERT";
  if (mode === "BUY" && !page.isDemo) return fail("This store doesn't accept AI buyers yet, so Standby can only watch and alert you.");

  const maxTotalCents = Math.round(Number(body.maxTotalUsd) * 100);
  const quantity = Math.round(Number(body.quantity));
  const days = Math.round(Number(body.expiresInDays));
  const mustHave = Array.isArray(body.mustHave) ? body.mustHave.map(String).filter(Boolean).slice(0, 8) : [];
  if (!(maxTotalCents >= 100 && maxTotalCents <= 100000)) return fail("Set a limit between $1 and $1,000.");
  if (!(quantity >= 1 && quantity <= 4)) return fail("Quantity must be between 1 and 4.");
  if (!(days >= 1 && days <= 29)) return fail("Watch for 1 to 29 days. A PayPal hold lasts 29 days at most.");
  if (mode === "BUY" && !paypalConfigured()) return fail("PayPal isn't connected yet, so Buy for me can't start. Alert me works without it.", 503);

  if (page.isDemo) {
    const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
    if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo.");
  }

  const sellerName = page.isDemo && page.storeName === "Wren" && !body.anySeller ? "Wren" : null;
  const mandate = await prisma.mandate.create({
    data: {
      ownerId: owner.id,
      wants: String(body.wants).slice(0, 500),
      title: String(body.title || page.name).slice(0, 60),
      mustHave: JSON.stringify(mustHave),
      listingUrl: page.url,
      listingId: page.listingId,
      itemName: page.name,
      sellerName,
      kind: page.kind,
      quantity,
      maxTotalCents,
      expiresAt: new Date(Date.now() + days * 86_400_000),
      days,
      mode,
      isDemo: page.isDemo,
      storeName: page.storeName,
      checkEverySec: page.isDemo ? DEMO_PACE_SEC : REAL_PACE_SEC,
      maxVisits: page.isDemo ? DEMO_MAX_VISITS : REAL_MAX_VISITS,
      // Alert mode needs nothing from PayPal to start.
      status: mode === "ALERT" ? "WATCHING" : "SETUP",
      lastNote: mode === "ALERT" ? "Watching. You'll be told when it matches." : null,
    },
  });

  if (mode === "ALERT") return NextResponse.json({ id: mandate.id });

  try {
    const approveUrl = await startHold(mandate, publicOrigin(req));
    return NextResponse.json({ id: mandate.id, approveUrl });
  } catch (e) {
    return NextResponse.json({ id: mandate.id, error: e instanceof Error ? e.message : "PayPal didn't respond." }, { status: 502 });
  }
}
