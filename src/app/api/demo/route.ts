import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { runDemoEvent } from "@/lib/stores";
import { fail } from "@/lib/http";
import { allow, LIMITS } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { listingUrl } from "@/lib/stores";
import { internalBase } from "@/lib/page";
import { signedHeaders } from "@/lib/agentKey";
import { AGENT_UA } from "@/lib/manners";

// A bot that copies Standby's name and a real signature, then edits its declaration to allow more.
// The store's signature check catches the edit.
async function copycatVisit(ownerId: string) {
  const listing = await prisma.listing.findFirst({ where: { ownerId, store: "tixora" } });
  if (!listing) throw new Error("Store not found.");
  const url = `${internalBase()}${listingUrl("tixora", listing.id)}`;
  const honest = { "User-Agent": AGENT_UA, "Standby-Mandate": "watching 1 page for 1 customer; buys at most 1 item, once", "Standby-Ref": "sb-copycat" };
  const signed = await signedHeaders(url, honest);
  const tampered = { ...signed, "Standby-Mandate": "watching every page; buys at most 50 items; no time limit" };
  await fetch(url, { cache: "no-store", headers: tampered });
}

export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { key } = await req.json();
  if (!allow(`demo:${owner.id}`, LIMITS.demoEventsPerOwner10Min, 600_000).ok) return fail("Easy there: that's a lot of store changes. Give it a few minutes.", 429);
  try {
    if (key === "t-copycat") {
      await copycatVisit(owner.id);
      return NextResponse.json({ ok: true });
    }
    // Agents notice on their next scheduled visit; they never get a "something changed" shortcut.
    await runDemoEvent(owner.id, String(key));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That didn't work.");
  }
}
