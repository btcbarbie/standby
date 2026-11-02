import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";

// Every decision on every one of your watches (hidden ones too), for the audit log.
export async function GET() {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const rows = await prisma.decision.findMany({
    where: { mandate: { ownerId: owner.id } },
    orderBy: { createdAt: "desc" },
    include: { mandate: { select: { id: true, title: true, storeName: true, isDemo: true } } },
  });
  return NextResponse.json(
    rows.map((d) => {
      const scout = JSON.parse(d.scout) as { isMatch: boolean; by?: string };
      const banker = d.banker ? (JSON.parse(d.banker) as { verdict: string; redFlags: string[]; by?: string }) : null;
      const vault = d.vault ? (JSON.parse(d.vault) as { pass: boolean }) : null;
      return {
        id: d.id,
        seq: d.seq,
        at: d.createdAt.toISOString(),
        watchId: d.mandate.id,
        watch: d.mandate.title,
        store: d.mandate.storeName || "Demo store",
        demo: d.mandate.isDemo,
        offer: d.offerLabel,
        scout: scout.isMatch ? "yes" : "no",
        scoutBy: scout.by ?? "",
        banker: banker ? (banker.redFlags.length ? "red flag" : banker.verdict === "APPROVE" ? "yes" : banker.verdict === "REJECT" ? "no" : "unsure") : "—",
        bankerBy: banker?.by ?? "",
        vault: vault ? (vault.pass ? "pass" : "block") : "—",
        outcome: d.outcome,
        totalCents: d.totalCents,
        paid: ["BOUGHT", "APPROVED"].includes(d.outcome) && !!d.paypalCaptureId,
        capture: d.paypalCaptureId,
        decidedBy: d.decidedBy === "you" ? "You" : "The checks",
        seal: d.seal,
        changed: d.snapshot.includes('"__original"'),
      };
    }),
  );
}
