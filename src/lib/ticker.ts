import { prisma } from "./prisma";
import { checkMandate } from "./watch";

// Watching while you're away: every few seconds, look at each active watch that hasn't been checked recently.
const EVERY_MS = 5_000;
const RECHECK_AFTER_MS = 12_000;

const g = globalThis as unknown as { standbyTicker?: NodeJS.Timeout };

export function startTicker() {
  if (g.standbyTicker) return;
  g.standbyTicker = setInterval(tick, EVERY_MS);
}

async function tick() {
  try {
    const due = await prisma.mandate.findMany({
      where: {
        status: "WATCHING",
        owner: { stopped: false },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - RECHECK_AFTER_MS) } }],
      },
      select: { id: true },
      take: 20,
    });
    await Promise.all(due.map((m) => checkMandate(m.id)));
  } catch (e) {
    console.error("Watch tick failed", e);
  }
}

// After something changes on a store, look straight away instead of waiting for the next tick.
export async function checkListingNow(listingId: string) {
  const watching = await prisma.mandate.findMany({ where: { listingId, status: "WATCHING" }, select: { id: true } });
  await Promise.all(watching.map((m) => checkMandate(m.id)));
}
