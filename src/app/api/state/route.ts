import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { loadState } from "@/lib/state";
import { fail } from "@/lib/http";

export async function GET(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const watchId = req.nextUrl.searchParams.get("watch");
  return NextResponse.json(await loadState(owner.id, watchId));
}
