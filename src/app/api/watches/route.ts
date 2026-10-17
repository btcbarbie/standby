import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { readPage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { createHold, paypalConfigured } from "@/lib/paypal";
import { fail, publicOrigin, storePath } from "@/lib/http";
import { money } from "@/lib/format";

// Step 2: the owner confirms the checklist. Standby asks PayPal for a hold of the most this watch may spend.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const body = await req.json();
  const path = storePath(String(body.url ?? ""));
  if (!path) return fail("That link isn't one Standby can watch.");

  const maxTotalCents = Math.round(Number(body.maxTotalUsd) * 100);
  const quantity = Math.round(Number(body.quantity));
  const days = Math.round(Number(body.expiresInDays));
  const mustHave = Array.isArray(body.mustHave) ? body.mustHave.map(String).filter(Boolean).slice(0, 8) : [];
  if (!(maxTotalCents >= 100 && maxTotalCents <= 100000)) return fail("Set a limit between $1 and $1,000.");
  if (!(quantity >= 1 && quantity <= 4)) return fail("Quantity must be between 1 and 4.");
  if (!(days >= 1 && days <= 29)) return fail("Watch for 1 to 29 days. A PayPal hold lasts 29 days at most.");
  if (!paypalConfigured()) return fail("PayPal isn't connected yet. Add the sandbox keys to turn watches on.", 503);

  const page = await readPage(path);
  const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
  if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo.");

  const sellerName = body.anySeller || listing.store === "tixora" ? null : "Wren";
  const mandate = await prisma.mandate.create({
    data: {
      ownerId: owner.id,
      wants: String(body.wants).slice(0, 500),
      title: String(body.title || page.name).slice(0, 60),
      mustHave: JSON.stringify(mustHave),
      listingUrl: path,
      listingId: page.listingId,
      itemName: page.name,
      sellerName,
      kind: page.kind,
      quantity,
      maxTotalCents,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    },
  });

  try {
    const origin = publicOrigin(req);
    const hold = await createHold({
      mandateId: mandate.id,
      amountCents: maxTotalCents,
      description: `Standby hold: ${mandate.title} (up to ${money(maxTotalCents)})`,
      returnUrl: `${origin}/paypal/return?watch=${mandate.id}`,
      cancelUrl: `${origin}/paypal/cancel?watch=${mandate.id}`,
    });
    await prisma.mandate.update({ where: { id: mandate.id }, data: { paypalOrderId: hold.orderId } });
    return NextResponse.json({ id: mandate.id, approveUrl: hold.approveUrl });
  } catch (e) {
    return NextResponse.json({ id: mandate.id, error: e instanceof Error ? e.message : "PayPal didn't respond." }, { status: 502 });
  }
}
