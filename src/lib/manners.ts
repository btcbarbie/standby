import type { Mandate } from "@prisma/client";
import { internalBase } from "./page";

// Guardrails for the store: the agent visits one page, at a fixed pace, a limited number of times,
// for a limited time, says who it is on every visit, and backs off when the store asks.

// The demo stores let agents check every 10 seconds so you can watch it happen.
// A real store would get one visit every 5 minutes.
export const DEMO_PACE_SEC = 10;
export const REAL_PACE_SEC = 300;
export const DEMO_MAX_VISITS = 600;
export const SLOW_PACE_SEC = 60;
export const REAL_MAX_VISITS = 500;

export const AGENT_UA = "StandbyAgent/1.0 (one page, one customer)";

export function effectivePaceSec(m: Pick<Mandate, "checkEverySec" | "storePolicy">) {
  return m.storePolicy === "SLOW" ? Math.max(m.checkEverySec, SLOW_PACE_SEC) : m.checkEverySec;
}

export function isDue(m: Pick<Mandate, "checkEverySec" | "storePolicy" | "lastCheckedAt" | "backoffUntil">, now = Date.now()) {
  if (m.backoffUntil && m.backoffUntil.getTime() > now) return false;
  if (!m.lastCheckedAt) return true;
  return now - m.lastCheckedAt.getTime() >= effectivePaceSec(m) * 1000;
}

// What the agent tells the store about itself on every visit. No personal data: a watch reference only.
export function declaration(m: Pick<Mandate, "quantity" | "expiresAt" | "checkEverySec" | "maxVisits" | "visits" | "mode">) {
  return [
    "watching 1 page for 1 customer",
    m.mode === "ALERT" ? "never buys: tells its customer, who checks out themselves" : `buys at most ${m.quantity} item${m.quantity > 1 ? "s" : ""}, once`,
    `until ${m.expiresAt.toISOString().slice(0, 10)}`,
    `checks every ${m.checkEverySec}s`,
    `visit ${m.visits + 1} of ${m.maxVisits}`,
  ].join("; ");
}

export function agentRef(mandateId: string) {
  return `sb-${mandateId.slice(-8)}`;
}

export function agentHeaders(m: Mandate | null): Record<string, string> {
  if (!m) {
    return { "User-Agent": AGENT_UA, "Standby-Mandate": "setting up a watch; reading this page once", "Standby-Ref": "setup" };
  }
  return { "User-Agent": AGENT_UA, "Standby-Mandate": declaration(m), "Standby-Ref": agentRef(m.id) };
}

// The store's published rules for AI agents (like robots.txt). Re-read at most every 20 seconds per page.
export type StorePolicy = "WELCOME" | "SLOW" | "CLOSED";
const policyCache = new Map<string, { at: number; policy: StorePolicy }>();

export async function storePolicy(listingId: string): Promise<StorePolicy> {
  const hit = policyCache.get(listingId);
  if (hit && Date.now() - hit.at < 20_000) return hit.policy;
  try {
    const url = `${internalBase()}/store/agents/${listingId}`;
    const { signedHeaders } = await import("./agentKey");
    const res = await fetch(url, { cache: "no-store", headers: await signedHeaders(url, { "User-Agent": AGENT_UA }) });
    const json = await res.json();
    const policy: StorePolicy = json.aiAgents === "closed" ? "CLOSED" : json.aiAgents === "slow" ? "SLOW" : "WELCOME";
    policyCache.set(listingId, { at: Date.now(), policy });
    return policy;
  } catch {
    return hit?.policy ?? "WELCOME";
  }
}

export function forgetPolicy(listingId: string) {
  policyCache.delete(listingId);
}
