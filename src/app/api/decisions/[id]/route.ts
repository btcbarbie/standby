import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { decide } from "@/lib/watch";
import { fail } from "@/lib/http";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/decisions/[id]">) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { id } = await ctx.params;
  const { approve } = await req.json();
  try {
    await decide(owner.id, id, Boolean(approve));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That didn't work.");
  }
}
