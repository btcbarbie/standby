import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { fail } from "@/lib/http";
import { setDressStock } from "@/lib/stores";

// The demo store's size list. Each visitor has their own copy of the store, so this only changes theirs.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { listingId, changes } = await req.json();
  if (!Array.isArray(changes) || changes.length === 0) return fail("Pick a size first.");
  try {
    await setDressStock(owner.id, String(listingId), changes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That didn't work.");
  }
}
