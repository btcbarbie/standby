import type { Mandate } from "@prisma/client";
import { prisma } from "./prisma";
import { createHold } from "./paypal";
import { money } from "./format";

// Asks PayPal for a hold of the most this watch may spend. The owner approves it on PayPal's own page.
export async function startHold(m: Mandate, origin: string) {
  const round = Date.now();
  const hold = await createHold({
    mandateId: m.id,
    round,
    amountCents: m.maxTotalCents,
    description: `Standby hold: ${m.title} (up to ${money(m.maxTotalCents)})`,
    returnUrl: `${origin}/paypal/return?watch=${m.id}`,
    cancelUrl: `${origin}/paypal/cancel?watch=${m.id}`,
  });
  await prisma.mandate.update({ where: { id: m.id }, data: { paypalOrderId: hold.orderId } });
  return hold.approveUrl;
}
