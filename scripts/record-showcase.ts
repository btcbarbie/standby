// Records real runs for the homepage's "safety" and hero examples.
// Uses the actual system: the demo store page read over HTTP (needs `npm run dev`), Scout (Gemini, or Claude if no key),
// the Banker (Claude), the Vault, and the same ruling function as the live watcher. Nothing is invented:
// the homepage shows exactly what this run returned, with the date.
//
//   npm run dev            (in another terminal)
//   npm run record:showcase

import { writeFileSync, mkdirSync } from "fs";
import path from "path";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { seedStores, runDemoEvent } = await import("../src/lib/stores");
  const { readPage } = await import("../src/lib/page");
  const { agentHeaders } = await import("../src/lib/manners");
  const { scoutLook, bankerReview, GEMINI_MODEL, MODEL } = await import("../src/lib/ai");
  const { runVault } = await import("../src/lib/vault");
  const { ruling } = await import("../src/lib/ruling");

  const owner = await prisma.owner.create({ data: {} });
  try {
    await seedStores(owner.id);
    for (const k of ["t-wrong-side", "t-fees", "t-trick", "t-match"]) await runDemoEvent(owner.id, k);
    const tix = await prisma.listing.findFirstOrThrow({ where: { ownerId: owner.id, store: "tixora" }, include: { offers: true } });

    const wants = "One ticket for the Nova Adé show, left wing only, under $40 including fees. Just one ticket, never more.";
    const mustHave = ["Left wing (Sections 101–108)", "Total under $40 including the service fee", "Exactly 1 ticket, never more"];
    const allowed = ["101", "102", "103", "104", "105", "106", "107", "108"].map((n) => `Section ${n}`);
    // Status FOUND keeps the background watcher away from this recording mandate.
    const m = await prisma.mandate.create({
      data: {
        ownerId: owner.id,
        wants,
        title: "1 left-wing ticket under $40",
        mustHave: JSON.stringify(mustHave),
        listingUrl: `/store/tixora/e/${tix.id}`,
        listingId: tix.id,
        itemName: tix.name,
        kind: "TICKET",
        quantity: 1,
        maxTotalCents: 4000,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        days: 7,
        mode: "ALERT",
        isDemo: true,
        storeName: "Tixora",
        mustMatch: JSON.stringify(allowed),
        status: "FOUND",
      },
    });

    const page = await readPage(m.listingUrl, agentHeaders(m));
    const scenarios = [
      { key: "match", title: "The genuine match", section: "106" },
      { key: "trick", title: "A hidden instruction", section: "102" },
      { key: "fees", title: "Over the price limit", section: "103" },
      { key: "wrongSide", title: "The wrong section", section: "119" },
    ];

    const runs = [];
    for (const s of scenarios) {
      const offer = tix.offers.find((o) => JSON.parse(o.attrs).section === s.section)!;
      const pageOffer = page.offers.find((o) => o.id === offer.id)!;
      const input = {
        wants,
        mustHave,
        quantity: 1,
        maxTotalUsd: 40,
        offer: `${pageOffer.name} (ref ${pageOffer.ref}), listed at $${(pageOffer.priceCents / 100).toFixed(2)} by ${pageOffer.seller}`,
        pageText: page.text,
      };
      const [scout, banker] = await Promise.all([scoutLook(input), bankerReview(input)]);
      const vault = await runVault(owner, m, offer.id, scout.isMatch ? scout.quantity : 1, pageOffer);
      const outcome = ruling({ vaultPass: vault.pass, scoutYes: scout.isMatch, bankerApproves: banker.verdict === "APPROVE", redFlags: banker.redFlags.length, mode: "ALERT" });
      runs.push({
        key: s.key,
        title: s.title,
        offer: { name: offer.label, priceCents: offer.priceCents, feeCents: offer.feeCents, seller: offer.seller, hiddenNote: offer.hiddenNote || null },
        scout: { yes: scout.isMatch, quantity: scout.quantity, line: scout.line, by: scout.by },
        banker: { verdict: banker.verdict, line: banker.line, redFlags: banker.redFlags, by: banker.by },
        vault: { pass: vault.pass, line: vault.line, failed: vault.checks.filter((c) => !c.ok).map((c) => c.label) },
        outcome,
      });
      console.log(`${s.title}: ${outcome} (Scout ${scout.isMatch ? "yes" : "no"} via ${scout.by}, Banker ${banker.verdict}, Vault ${vault.pass ? "pass" : "block"})`);
    }

    // Time from the internet, not this machine's clock (which can be wrong).
    const net = await fetch("https://www.google.com", { method: "HEAD" }).then((r) => r.headers.get("date")).catch(() => null);
    const out = {
      recordedAt: (net ? new Date(net) : new Date()).toISOString(),
      models: { scout: process.env.GEMINI_API_KEY ? GEMINI_MODEL : MODEL, banker: MODEL },
      mandate: { wants, limitCents: 4000, allowed: "Sections 101–108", quantity: 1, mode: "Alert me" },
      runs,
    };
    const file = path.join(process.cwd(), "src", "data", "showcase.json");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
    console.log(`Saved ${file}`);
  } finally {
    await prisma.owner.delete({ where: { id: owner.id } });
    await prisma.$disconnect();
  }
}

main();
