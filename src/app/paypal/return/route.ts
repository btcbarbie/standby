import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
        await prisma.mandate.update({ where: { id: d.mandateId }, data: { lastNote: `Payment didn't go through: ${e instanceof Error ? e.message : "unknown error"}` } });
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
          lastNote: "Hold approved. Watching.",
          lastCheckedAt: null,
        },
      });
    } catch (e) {
      await prisma.mandate.update({ where: { id }, data: { lastNote: `PayPal hold failed: ${e instanceof Error ? e.message : "unknown error"}` } });
    }
  }
  return new NextResponse(null, { status: 307, headers: { Location: `/app/w/${id}` } });
}
