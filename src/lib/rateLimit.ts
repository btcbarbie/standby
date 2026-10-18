import type { NextRequest } from "next/server";

// Simple in-memory limits for the public demo, so nobody can run up AI costs.
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryInMin: Math.ceil((windowMs - (now - recent[0])) / 60_000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return { ok: true, retryInMin: 0 };
}

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

export const LIMITS = {
  draftsPerOwnerHour: 10,
  draftsPerIpHour: 30,
  demoEventsPerOwner10Min: 30,
  activeWatchesPerOwner: 3,
};
