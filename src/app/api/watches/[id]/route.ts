import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { checkMandate, endWatch } from "@/lib/watch";
import { fail } from "@/lib/http";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/watches/[id]">) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { id } = await ctx.params;
  const m = await prisma.mandate.findUnique({ where: { id } });
  if (!m || m.ownerId !== owner.id) return fail("Not found.", 404);
  const { action } = await req.json();

  if (action === "pause" && m.status === "WATCHING") {
    await prisma.mandate.update({ where: { id }, data: { status: "PAUSED", lastNote: "Paused by you." } });
  } else if (action === "resume" && m.status === "PAUSED") {
    await prisma.mandate.update({ where: { id }, data: { status: "WATCHING", lastNote: "Watching again.", lastCheckedAt: null } });
  } else if (action === "end" && !["BOUGHT", "ENDED"].includes(m.status)) {
    await endWatch(m, "Ended by you. Hold released.");
  } else if (action === "check" && m.status === "WATCHING") {
    void checkMandate(id);
  } else {
    return fail("That can't be done right now.");
  }
  return NextResponse.json({ ok: true });
}
