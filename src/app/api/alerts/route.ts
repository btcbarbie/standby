import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";

// Mark alerts as seen: one watch's (when you open it), some by id, or all.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { watchId, ids } = await req.json().catch(() => ({}));
  await prisma.event.updateMany({
    where: {
      alert: true,
      seenAt: null,
      mandate: { ownerId: owner.id },
      ...(watchId ? { mandateId: String(watchId) } : {}),
      ...(Array.isArray(ids) ? { id: { in: ids.map(String) } } : {}),
    },
    data: { seenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
