import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";
import { verifyChains } from "@/lib/seal";

// Recompute every seal on your watches and check each link in the chain.
export async function POST() {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const ids = (await prisma.mandate.findMany({ where: { ownerId: owner.id }, select: { id: true } })).map((m) => m.id);
  const checks = await verifyChains(ids);
  return NextResponse.json({ checkedAt: new Date().toISOString(), total: checks.length, broken: checks.filter((c) => !c.ok).length, checks });
}
