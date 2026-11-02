import { createHash } from "crypto";
import { prisma } from "./prisma";

// Every decision is sealed to the one before it: its seal is a hash of the previous seal plus what was decided on
// (the offer, the page snapshot, Scout's and the Banker's answers, and when). Changing any of those later, or
// removing a decision, breaks the chain from that point on.

export function sealOf(d: { prevSeal: string; seq: number; mandateId: string; offerId: string; snapshot: string; scout: string; banker: string | null; at: Date }) {
  return createHash("sha256")
    .update(JSON.stringify({ prevSeal: d.prevSeal, seq: d.seq, mandateId: d.mandateId, offerId: d.offerId, snapshot: d.snapshot, scout: d.scout, banker: d.banker ?? null, at: d.at.toISOString() }))
    .digest("hex");
}

export type ChainCheck = { id: string; ok: boolean; problem: string | null };

// Recompute every seal for these watches and check each link to the decision before it.
export async function verifyChains(mandateIds: string[]): Promise<ChainCheck[]> {
  const rows = await prisma.decision.findMany({ where: { mandateId: { in: mandateIds } }, orderBy: [{ mandateId: "asc" }, { seq: "asc" }] });
  const out: ChainCheck[] = [];
  let prev: { mandateId: string; seal: string; seq: number } | null = null;
  for (const d of rows) {
    const first: boolean = !prev || prev.mandateId !== d.mandateId;
    const expectedPrev: string = first ? "genesis" : prev!.seal;
    const expectedSeq: number = first ? 1 : prev!.seq + 1;
    let problem: string | null = null;
    if (d.seq !== expectedSeq) problem = `A decision is missing before this one (expected #${expectedSeq}).`;
    else if (d.prevSeal !== expectedPrev) problem = "It no longer links to the decision before it.";
    else if (sealOf({ prevSeal: d.prevSeal, seq: d.seq, mandateId: d.mandateId, offerId: d.offerId, snapshot: d.snapshot, scout: d.scout, banker: d.banker, at: d.createdAt }) !== d.seal)
      problem = "Its contents were changed after it was sealed.";
    out.push({ id: d.id, ok: !problem, problem });
    prev = { mandateId: d.mandateId, seal: d.seal, seq: d.seq };
  }
  return out;
}
