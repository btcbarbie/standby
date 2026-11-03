import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { say } from "@/lib/events";
import { checkMandate, endWatch } from "@/lib/watch";
import { fail, publicOrigin } from "@/lib/http";
import { paypalConfigured } from "@/lib/paypal";
import { startHold } from "@/lib/holds";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/watches/[id]">) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { id } = await ctx.params;
  const m = await prisma.mandate.findUnique({ where: { id } });
  if (!m || m.ownerId !== owner.id) return fail("Not found.", 404);
  const { action } = await req.json();

  if (action === "pause" && m.status === "WATCHING") {
    await prisma.mandate.update({ where: { id }, data: { status: "PAUSED", pausedReason: "YOU" } });
    await say(id, "YOU", m.mode === "BUY" ? "Pause for now. Keep the hold." : "Pause for now.");
  } else if (action === "resume" && m.status === "PAUSED" && m.pausedReason === "YOU") {
    await prisma.mandate.update({ where: { id }, data: { status: "WATCHING", pausedReason: null } });
    await say(id, "YOU", "Start watching again.");
  } else if (action === "reactivate" && m.status === "PAUSED" && m.pausedReason !== "YOU") {
    // A fresh round: new deadline, new visit allowance, and (in buy mode) a new PayPal hold to approve.
    if (m.mode === "ALERT") {
      await prisma.mandate.update({
        where: { id },
        data: { status: "WATCHING", pausedReason: null, expiresAt: new Date(Date.now() + m.days * 86_400_000), visits: 0, backoffUntil: null },
      });
      await say(id, "YOU", `Reactivate for another ${m.days} days.`);
      return NextResponse.json({ ok: true });
    }
    if (!paypalConfigured()) return fail("PayPal isn't connected on this server yet.", 503);
    const fresh = await prisma.mandate.update({
      where: { id },
      data: {
        status: "SETUP",
        pausedReason: null,
        expiresAt: new Date(Date.now() + m.days * 86_400_000),
        visits: 0,
        backoffUntil: null,
        paypalAuthorizationId: null,
        heldCents: null,
      },
    });
    await say(id, "YOU", `Reactivate for another ${m.days} days. I'll approve a new PayPal hold.`);
    try {
      return NextResponse.json({ ok: true, approveUrl: await startHold(fresh, publicOrigin(req)) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "PayPal didn't respond.", 502);
    }
  } else if (action === "end" && !["BOUGHT", "ENDED"].includes(m.status)) {
    await endWatch(m, "Ended by you. Hold released.");
  } else if (action === "hide" && ["BOUGHT", "ENDED"].includes(m.status)) {
    await prisma.mandate.update({ where: { id }, data: { hidden: true } });
  } else if (action === "unhide") {
    await prisma.mandate.update({ where: { id }, data: { hidden: false } });
  } else if (action === "start" && m.status === "WATCHING" && m.notBefore && m.notBefore > new Date()) {
    // You changed your mind about the start time: drop it and look now.
    await prisma.mandate.update({ where: { id }, data: { notBefore: null } });
    await say(id, "YOU", "Start now instead of waiting.");
    void checkMandate(id, { force: true });
  } else if (action === "check" && m.status === "WATCHING") {
    const wait = whyWait(m);
    if (wait) return NextResponse.json({ ok: true, note: wait });
    void checkMandate(id, { force: true });
  } else {
    return fail("That can't be done right now.");
  }
  return NextResponse.json({ ok: true });
}

// "Check now" never overrides the store's wishes or the polite pace. When it has to wait, say why instead of doing nothing.
function whyWait(m: { notBefore: Date | null; backoffUntil: Date | null; lastCheckedAt: Date | null; isDemo: boolean; storePolicy: string | null }) {
  const now = Date.now();
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const inWords = (ms: number) => (ms < 90_000 ? plural(Math.max(1, Math.ceil(ms / 1000)), "second") : plural(Math.ceil(ms / 60_000), "minute"));
  if (m.notBefore && m.notBefore.getTime() > now) return "This watch starts at the time you set. Use Start now to begin earlier.";
  if (m.backoffUntil && m.backoffUntil.getTime() > now) return `The store asked for a break. Scout visits again in ${inWords(m.backoffUntil.getTime() - now)}.`;
  if (m.storePolicy === "SLOW") return "The store asked AI agents to slow down, so Scout keeps to its pace.";
  const minGap = m.isDemo ? 5_000 : 60_000;
  const since = m.lastCheckedAt ? now - m.lastCheckedAt.getTime() : Infinity;
  if (since < minGap) return `Scout just looked. To be polite to the store, try again in ${inWords(minGap - since)}.`;
  return null;
}
