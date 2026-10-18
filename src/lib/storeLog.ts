import { headers } from "next/headers";
import { prisma } from "./prisma";

// The store records every AI agent that introduces itself, so the seller can see who is visiting and why.
export async function logAgentVisit(listingId: string) {
  const h = await headers();
  const agent = h.get("user-agent") ?? "";
  if (!agent.startsWith("StandbyAgent")) return;
  await prisma.storeVisit.create({
    data: {
      listingId,
      agent,
      declared: (h.get("standby-mandate") ?? "").slice(0, 300),
      mandateRef: (h.get("standby-ref") ?? "unknown").slice(0, 40),
    },
  });
}

export async function agentVisitors(listingId: string) {
  const visits = await prisma.storeVisit.findMany({ where: { listingId }, orderBy: { at: "desc" }, take: 2000 });
  const byRef = new Map<string, { ref: string; agent: string; declared: string; visits: number; first: Date; last: Date }>();
  for (const v of visits) {
    const row = byRef.get(v.mandateRef);
    if (row) {
      row.visits += 1;
      row.first = v.at;
    } else {
      byRef.set(v.mandateRef, { ref: v.mandateRef, agent: v.agent, declared: v.declared, visits: 1, first: v.at, last: v.at });
    }
  }
  const since = new Date(Date.now() - 60 * 60_000);
  return {
    agents: [...byRef.values()].map((r) => ({ ...r, first: r.first.toISOString(), last: r.last.toISOString() })),
    lastHour: visits.filter((v) => v.at >= since).length,
  };
}
