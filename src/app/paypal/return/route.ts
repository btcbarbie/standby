import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { say } from "@/lib/events";
import { authorizeHold, capturePayment } from "@/lib/paypal";
import { completeAlertPayment } from "@/lib/watch";

// PayPal sends the owner back here after they approve the hold.
export async function GET(req: NextRequest) {
  // Alert mode: the owner approved one payment for a find.
  const payFor = req.nextUrl.searchParams.get("pay");
  if (payFor) {
    const d = await prisma.decision.findUnique({ where: { id: payFor } });
    const token = req.nextUrl.searchParams.get("token") ?? "";
    if (d && d.outcome === "FOUND" && d.paypalOrderId && d.paypalOrderId === token) {
      try {
        const { captureId } = await capturePayment(d.paypalOrderId);
        await completeAlertPayment(d.id, captureId);
      } catch (e) {
        await say(d.mandateId, "PAYPAL", `Payment didn't go through: ${e instanceof Error ? e.message : "unknown error"}`, { alert: true, decisionId: d.id });
      }
    }
    return new NextResponse(null, { status: 307, headers: { Location: d ? `/app/w/${d.mandateId}` : "/app" } });
  }

  const id = req.nextUrl.searchParams.get("watch") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const m = await prisma.mandate.findUnique({ where: { id } });
  if (!m || !m.paypalOrderId || m.paypalOrderId !== token) {
    return new NextResponse(null, { status: 307, headers: { Location: "/app" } });
  }
  if (m.status === "SETUP") {
    try {
      const hold = await authorizeHold(m.paypalOrderId);
      await prisma.mandate.update({
        where: { id },
        data: {
          status: "WATCHING",
          paypalAuthorizationId: hold.authorizationId,
          heldCents: m.maxTotalCents,
          holdExpiresAt: hold.expiresAt,
          lastCheckedAt: null,
        },
      });
      await say(id, "PAYPAL", `Hold approved: up to $${(m.maxTotalCents / 100).toFixed(2)} is held. Nothing is taken unless all three checks agree.`);
    } catch (e) {
      await say(id, "PAYPAL", `The hold failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }
  return new NextResponse(null, { status: 307, headers: { Location: `/app/w/${id}` } });
}
