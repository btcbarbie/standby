import { prisma } from "./prisma";
import { checkMandate } from "./watch";
import { isDue } from "./manners";

// Watching while you're away: every few seconds, see which watches are due a visit at their own polite pace.
const EVERY_MS = 2_000;

const g = globalThis as unknown as { standbyTicker?: NodeJS.Timeout };

export function startTicker() {
  if (g.standbyTicker) return;
  g.standbyTicker = setInterval(tick, EVERY_MS);
}

async function tick() {
  try {
    const watching = await prisma.mandate.findMany({ where: { status: "WATCHING", owner: { stopped: false } }, take: 200 });
    const due = watching.filter((m) => isDue(m) || new Date() > m.expiresAt);
    await Promise.all(due.slice(0, 20).map((m) => checkMandate(m.id)));
  } catch (e) {
    console.error("Watch tick failed", e);
  }
}


