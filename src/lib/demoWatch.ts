import { prisma } from "./prisma";
import { listingUrl, runDemoEvent } from "./stores";
import { DEMO_MAX_VISITS, DEMO_PACE_SEC } from "./manners";
import { say } from "./events";

// A first-time demo visitor arrives to a watch that's already running, so Scout, the Banker and the Vault
// can be seen at work within seconds, with nothing to set up. Alert mode, so no PayPal step is needed.
// The demo store then lists two seats on its own: one the Vault refuses (fees push it over $40), then the real deal.

const WANTS = "One ticket for the Nova Adé show, left wing only, under $40 including fees. Just one ticket.";

export async function startDemoWatch(ownerId: string) {
  const listing = await prisma.listing.findFirst({ where: { ownerId, store: "tixora" } });
  if (!listing) return;
  const days = 14;
  const m = await prisma.mandate.create({
    data: {
      ownerId,
      wants: WANTS,
      title: "1 left-wing ticket under $40",
      mustHave: JSON.stringify(["Left wing (sections 101–108)", "Total under $40 including the service fee", "Exactly 1 ticket"]),
      listingUrl: listingUrl("tixora", listing.id),
      listingId: listing.id,
      itemName: listing.name,
      kind: "TICKET",
      mustMatch: JSON.stringify([{ field: "section", values: ["101", "102", "103", "104", "105", "106", "107", "108"] }]),
      quantity: 1,
      maxTotalCents: 4000,
      expiresAt: new Date(Date.now() + days * 86_400_000),
      days,
      mode: "ALERT",
      isDemo: true,
      storeName: "Tixora",
      checkEverySec: DEMO_PACE_SEC,
      maxVisits: DEMO_MAX_VISITS,
      status: "WATCHING",
    },
  });
  await say(m.id, "YOU", WANTS, { note: false });
  await say(m.id, "SCOUT", "On it. I'll watch the Nova Adé page on Tixora and tell you the moment a left-wing seat under $40 turns up.");

  // The store's side of the story, a few seconds apart.
  setTimeout(() => void storeActivity(ownerId, m.id), 6_000);
}

async function storeActivity(ownerId: string, mandateId: string) {
  try {
    await runDemoEvent(ownerId, "t-fees");
    // Wait for the agents to finish weighing that seat (up to 2 minutes), then list the real deal.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3_000));
      if ((await prisma.decision.count({ where: { mandateId } })) > 0) break;
    }
    await runDemoEvent(ownerId, "t-match");
  } catch (e) {
    console.error("Demo store activity failed", e instanceof Error ? e.message : e);
  }
}
