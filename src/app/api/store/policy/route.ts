import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { forgetPolicy } from "@/lib/manners";
import { fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { listingId, policy } = await req.json();
  if (!["WELCOME", "SLOW", "CLOSED"].includes(policy)) return fail("Unknown policy.");
  const listing = await prisma.listing.findUnique({ where: { id: String(listingId) } });
  if (!listing || listing.ownerId !== owner.id) return fail("Not found.", 404);
  await prisma.listing.update({ where: { id: listing.id }, data: { agentPolicy: policy } });
  forgetPolicy(listing.id);
  return NextResponse.json({ ok: true });
}
