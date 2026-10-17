import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";

// Stop all: no agent may buy anything until it's switched back on.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { stopped } = await req.json();
  await prisma.owner.update({ where: { id: owner.id }, data: { stopped: Boolean(stopped) } });
  return NextResponse.json({ ok: true });
}
