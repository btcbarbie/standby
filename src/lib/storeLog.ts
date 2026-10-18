import { headers } from "next/headers";
import { verify } from "web-bot-auth";
import { verifierFromJWK } from "web-bot-auth/crypto";
import { prisma } from "./prisma";

// The store records every AI agent that introduces itself, so the seller can see who is visiting and why.
// It also checks each visit's Web Bot Auth signature against the public key the agent's operator publishes.

const directories = new Map<string, { at: number; keys: JsonWebKey[] }>();
const seenNonces = new Set<string>();

async function keysFor(origin: string): Promise<JsonWebKey[]> {
  const hit = directories.get(origin);
  if (hit && Date.now() - hit.at < 300_000) return hit.keys;
  const res = await fetch(`${origin}/.well-known/http-message-signatures-directory`, { cache: "no-store" });
  if (!res.ok) throw new Error("No key directory.");
  const keys = ((await res.json()).keys ?? []) as JsonWebKey[];
  directories.set(origin, { at: Date.now(), keys });
  return keys;
}

async function checkSignature(h: Headers, path: string): Promise<{ verified: boolean; signedBy: string | null }> {
  if (!h.get("signature") || !h.get("signature-input")) return { verified: false, signedBy: null };
  try {
    const request = new Request(`http://${h.get("host")}${path}`, { headers: h });
    const result = await verify(request, {
      maxAge: 120,
      clockSkew: 5,
      resolver: async (candidate) => {
        const origin = candidate.signatureAgent?.uri;
        if (!origin) throw new Error("No Signature-Agent.");
        const key = (await keysFor(origin)).find((k) => (k as { kid?: string }).kid === candidate.keyid);
        if (!key) throw new Error("Unknown key.");
        return verifierFromJWK(key);
      },
      validate: ({ nonce }) => {
        // A signature can only be used once.
        if (!nonce || seenNonces.has(nonce)) return false;
        seenNonces.add(nonce);
        if (seenNonces.size > 20_000) seenNonces.clear();
        return true;
      },
    });
    return { verified: true, signedBy: result.signatureAgent ? new URL(result.signatureAgent.uri).host : null };
  } catch {
    return { verified: false, signedBy: null };
  }
}

export async function logAgentVisit(listingId: string, path: string) {
  const h = await headers();
  const agent = h.get("user-agent") ?? "";
  if (!agent.startsWith("StandbyAgent")) return;
  const { verified, signedBy } = await checkSignature(new Headers(h), path);
  await prisma.storeVisit.create({
    data: {
      listingId,
      agent,
      declared: (h.get("standby-mandate") ?? "").slice(0, 300),
      mandateRef: (h.get("standby-ref") ?? "unknown").slice(0, 40),
      verified,
      signedBy,
    },
  });
}

export async function agentVisitors(listingId: string) {
  const visits = await prisma.storeVisit.findMany({ where: { listingId }, orderBy: { at: "desc" }, take: 2000 });
  type Row = { ref: string; agent: string; declared: string; visits: number; verifiedVisits: number; signedBy: string | null; first: Date; last: Date };
  const byRef = new Map<string, Row>();
  for (const v of visits) {
    const row = byRef.get(v.mandateRef);
    if (row) {
      row.visits += 1;
      if (v.verified) row.verifiedVisits += 1;
      row.first = v.at;
    } else {
      byRef.set(v.mandateRef, {
        ref: v.mandateRef,
        agent: v.agent,
        declared: v.declared,
        visits: 1,
        verifiedVisits: v.verified ? 1 : 0,
        signedBy: v.signedBy,
        first: v.at,
        last: v.at,
      });
    }
  }
  const since = new Date(Date.now() - 60 * 60_000);
  return {
    agents: [...byRef.values()].map((r) => ({
      ...r,
      // Judged on the latest visit: is this agent proving who it is right now?
      verified: visits.find((v) => v.mandateRef === r.ref)?.verified ?? false,
      first: r.first.toISOString(),
      last: r.last.toISOString(),
    })),
    lastHour: visits.filter((v) => v.at >= since).length,
  };
}
