import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { agentVisitors } from "@/lib/storeLog";
import { fail } from "@/lib/http";

// The seller's view (in the demo, the visitor also plays the store owner).
export async function GET(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const id = req.nextUrl.searchParams.get("listing") ?? "";
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.ownerId !== owner.id) return fail("Not found.", 404);
  return NextResponse.json({ policy: listing.agentPolicy, ...(await agentVisitors(id)) });
}
