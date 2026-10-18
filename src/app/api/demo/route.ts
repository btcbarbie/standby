import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { runDemoEvent } from "@/lib/stores";
import { fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { key } = await req.json();
  try {
    // Agents notice on their next scheduled visit; they never get a "something changed" shortcut.
    await runDemoEvent(owner.id, String(key));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That didn't work.");
  }
}
