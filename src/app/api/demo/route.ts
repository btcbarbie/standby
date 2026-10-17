import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { runDemoEvent } from "@/lib/stores";
import { checkListingNow } from "@/lib/ticker";
import { fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { key } = await req.json();
  try {
    const listing = await runDemoEvent(owner.id, String(key));
    // Don't make the store wait for the agents; they report back on the Standby screen.
    void checkListingNow(listing.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That didn't work.");
  }
}
