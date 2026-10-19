import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { decide, foundAction } from "@/lib/watch";
import { prisma } from "@/lib/prisma";
import { createPayment, paypalConfigured } from "@/lib/paypal";
import { fail, publicOrigin } from "@/lib/http";
import { money } from "@/lib/format";

// approve / deny: when the checks disagree. bought / pass / pay: after an alert-mode find.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/decisions/[id]">) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { id } = await ctx.params;
  const body = await req.json();
  try {
    if (body.action === "bought" || body.action === "pass") {
      await foundAction(owner.id, id, body.action);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "pay") {
      const d = await prisma.decision.findUnique({ where: { id }, include: { mandate: true } });
      if (!d || d.mandate.ownerId !== owner.id) return fail("Not found.", 404);
      if (d.outcome !== "FOUND" || !d.mandate.isDemo) return fail("This one can't be paid here.");
      if (!paypalConfigured()) return fail("PayPal isn't connected on this server yet.", 503);
      const origin = publicOrigin(req);
      const pay = await createPayment({
        decisionId: d.id,
        amountCents: d.totalCents ?? 0,
        description: `Standby: ${d.offerLabel} (${money(d.totalCents ?? 0)})`,
        returnUrl: `${origin}/paypal/return?pay=${d.id}`,
        cancelUrl: `${origin}/paypal/cancel?watch=${d.mandateId}`,
      });
      await prisma.decision.update({ where: { id: d.id }, data: { paypalOrderId: pay.orderId } });
      return NextResponse.json({ ok: true, approveUrl: pay.approveUrl });
    }
    await decide(owner.id, id, Boolean(body.approve));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That didn't work.");
  }
}
