import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";

// Demo only: quietly edit one of YOUR OWN past demo decisions (the price it was decided on), the way someone
// rewriting history would, so you can watch "Verify the chain" catch it. "restore" puts it back exactly.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { action } = await req.json().catch(() => ({}));
  const mine = { mandate: { ownerId: owner.id, isDemo: true } };

  if (action === "restore") {
    const changed = await prisma.decision.findMany({ where: { ...mine, snapshot: { contains: '"__original"' } } });
    for (const d of changed) {
      const snap = JSON.parse(d.snapshot);
      snap.priceCents = snap.__original;
      delete snap.__original;
      await prisma.decision.update({ where: { id: d.id }, data: { snapshot: JSON.stringify(snap) } });
    }
    return NextResponse.json({ restored: changed.length });
  }

  const target = await prisma.decision.findFirst({ where: { ...mine, NOT: { snapshot: { contains: '"__original"' } } }, orderBy: { createdAt: "asc" } });
  if (!target) return fail("There's no demo decision to change yet. Let a demo watch decide something first.");
  const snap = JSON.parse(target.snapshot);
  snap.__original = snap.priceCents;
  snap.priceCents = Math.max(100, Math.round(snap.priceCents / 2));
  await prisma.decision.update({ where: { id: target.id }, data: { snapshot: JSON.stringify(snap) } });
  return NextResponse.json({ changed: target.id, offer: target.offerLabel, from: snap.__original, to: snap.priceCents });
}
