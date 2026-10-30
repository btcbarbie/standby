import { createHash } from "crypto";
import type { Mandate } from "@prisma/client";
import { prisma } from "./prisma";
import { readPage, BackoffError, type PageOffer } from "./page";
import { RobotsBlocked } from "./safeFetch";
import { agentHeaders, isDue, storePolicy } from "./manners";
import { scoutLook, bankerReview, AiError, type ScoutLook, type BankerReview } from "./ai";
import { runVault, type VaultResult } from "./vault";
import { captureHold, releaseHold, PayPalError } from "./paypal";
import { placeOrder } from "./stores";
import { money } from "./format";
import { say } from "./events";
import { describeLocks, meetsLocks, type Lock } from "./extract";

// The watch loop. For each new offer that might fit, three independent checks:
//   Scout (AI shopper), the Banker (AI reviewer, never sees Scout's answer) and the Vault (rules in code).
//   Vault says no -> blocked. Scout and Banker both yes -> bought. Both no -> skipped. Otherwise -> you decide.

const busy = new Set<string>();

export function mustHave(m: Mandate): string[] {
  return JSON.parse(m.mustHave);
}

function offerText(o: PageOffer) {
  return `${o.name} (ref ${o.ref}), listed at ${money(o.priceCents)} by ${o.seller}`;
}

export async function checkMandate(mandateId: string, opts: { force?: boolean } = {}) {
  if (busy.has(mandateId)) return;
  busy.add(mandateId);
  try {
    const m = await prisma.mandate.findUnique({ where: { id: mandateId }, include: { owner: true } });
    if (!m || m.status !== "WATCHING") return;
    if (m.owner.stopped) return;

    // Time-limited: when the deadline passes, the watch pauses and the hold is released.
    if (new Date() > m.expiresAt) {
      await pauseWatch(m, "DEADLINE", `Time's up: nothing matched before your deadline.${m.mode === "BUY" ? " Hold released." : ""} Reactivate to keep watching.`);
      return;
    }
    // Timed watches (drops, launches): no visits at all until the chosen moment, then straight in.
    if (m.notBefore && new Date() < m.notBefore) {
      // {t:…} is shown in your own time zone.
      if (!m.lastNote?.startsWith("Waiting until")) await say(m.id, "SCOUT", `Waiting until {t:${m.notBefore.toISOString()}} to start, as you asked. I won't visit the store before then.`);
      return;
    }
    // Visit-limited: a watch can only visit the store so many times.
    if (m.visits >= m.maxVisits) {
      await pauseWatch(m, "VISIT_LIMIT", `Visit limit reached (${m.maxVisits} visits).${m.mode === "BUY" ? " Hold released." : ""} Reactivate to keep watching.`);
      return;
    }

    // The store's rules come first. Demo stores publish rules for AI agents; real stores have robots.txt (checked on every visit).
    const policy = m.isDemo ? await storePolicy(m.listingId) : "WELCOME";
    if (policy !== m.storePolicy) await prisma.mandate.update({ where: { id: m.id }, data: { storePolicy: policy } });
    if (policy === "CLOSED") {
      await pauseWatch(m, "STORE_CLOSED", `The store asked AI agents not to visit. Paused${m.mode === "BUY" ? " and hold released" : ""}.`);
      return;
    }
    const current = { ...m, storePolicy: policy };
    // A fixed pace. "Check now" can skip the wait only when the store hasn't asked agents to slow down,
    // and never more than once every 5 seconds. Backing off is never skipped.
    if (m.backoffUntil && m.backoffUntil > new Date()) return;
    const minGap = m.isDemo ? 5_000 : 60_000;
    const canForce = opts.force && policy === "WELCOME" && (!m.lastCheckedAt || Date.now() - m.lastCheckedAt.getTime() >= minGap);
    if (!canForce && !isDue(current)) return;

    const visit = await prisma.mandate.update({ where: { id: m.id }, data: { visits: { increment: 1 }, lastCheckedAt: new Date() } });
    let page;
    try {
      page = await readPage(m.listingUrl, agentHeaders(m));
    } catch (e) {
      if (e instanceof RobotsBlocked) {
        await pauseWatch(m, "STORE_CLOSED", "This store's robots.txt asks automated agents not to visit this page. Paused.");
        return;
      }
      if (e instanceof BackoffError) {
        await prisma.mandate.update({ where: { id: m.id }, data: { backoffUntil: new Date(Date.now() + e.seconds * 1000) } });
        await say(m.id, "SCOUT", `The store asked for a break. Waiting ${e.seconds}s before my next visit.`);
        return;
      }
      throw e;
    }
    if (page.listingId !== m.listingId) {
      await say(m.id, "SCOUT", "The page no longer shows the item you chose. Waiting.");
      return;
    }

    const seen = await prisma.decision.findMany({ where: { mandateId: m.id }, select: { offerId: true, snapshot: true } });
    const seenKeys = new Set(seen.map((d) => `${d.offerId}:${JSON.parse(d.snapshot).priceCents}`));

    // Options you didn't tick aren't even looked at (the Vault checks it again before anything happens).
    const picked: string[] | null = m.options ? JSON.parse(m.options) : null;
    // Details you required (section, row, seller, size...) are checked in code before any AI looks.
    const locks: Lock[] = m.mustMatch ? JSON.parse(m.mustMatch) : [];
    const pageInfo = { name: m.itemName, kind: m.kind as "TICKET" | "DRESS" | "ITEM" };
    const candidates = page.offers
      // Seller is a Vault rule, not a filter, so the Vault can show why another seller's offer was refused.
      .filter((o) => o.inStock)
      .filter((o) => !picked || picked.includes(o.name))
      .filter((o) => !locks.length || meetsLocks(pageInfo, o, locks).ok)
      .filter((o) => o.priceCents * m.quantity <= m.maxTotalCents)
      .filter((o) => !seenKeys.has(`${o.id}:${o.priceCents}`))
      .sort((a, b) => a.priceCents - b.priceCents);

    if (candidates.length === 0 && picked && !page.offers.some((o) => picked.includes(o.name) && o.inStock)) {
      await say(m.id, "SCOUT", `Checked the page: ${picked.length === 1 ? "your pick is" : "your picks are"} still sold out. Watching for a restock.`);
      return;
    }
    if (candidates.length === 0) {
      const what = locks.length ? `nothing new with ${describeLocks(locks)} under ${money(m.maxTotalCents)}` : `nothing new under ${money(m.maxTotalCents)}`;
      await say(m.id, "SCOUT", policy === "SLOW" ? `Checked the page: ${what}. The store asked for one visit a minute.` : `Checked the page: ${what}.`);
      return;
    }

    await evaluate({ ...visit, owner: m.owner }, candidates[0], page.text);
  } catch (e) {
    const msg = e instanceof AiError || e instanceof PayPalError || e instanceof Error ? e.message : "Something went wrong.";
    await say(mandateId, "STANDBY", `Couldn't check just now: ${msg}`).catch(() => {});
  } finally {
    busy.delete(mandateId);
  }
}

// The quiet status line only (the decision itself shows in the conversation).
async function note(mandateId: string, text: string) {
  await prisma.mandate.update({ where: { id: mandateId }, data: { lastNote: text } });
}

async function evaluate(m: Mandate & { owner: { id: string; stopped: boolean; createdAt: Date } }, offer: PageOffer, pageText: string) {
  const checklist = mustHave(m);
  const base = { wants: m.wants, mustHave: checklist, quantity: m.quantity, maxTotalUsd: m.maxTotalCents / 100, offer: offerText(offer), pageText };
  const snapshot = JSON.stringify({ ...offer, priceCents: offer.priceCents, excerpt: pageText.slice(0, 4000) });

  // All three judge every offer independently and at the same time. The Banker never sees Scout's answer.
  await note(m.id, `Scout, the Banker and the Vault are looking at ${offer.name}…`);
  const [scout, banker] = await Promise.all([scoutLook(base), bankerReview(base)]);
  const quantity = scout.isMatch ? scout.quantity : m.quantity;
  const vault = await runVault(m.owner, m, offer.id, quantity, offer);

  const scoutYes = scout.isMatch;
  const bankerYes = banker.verdict === "APPROVE" && banker.redFlags.length === 0;
  const record = {
    offerId: offer.id,
    offerLabel: offer.name,
    snapshot,
    scout: JSON.stringify({ ...scout, quantity }),
    banker: JSON.stringify(banker),
    vault: JSON.stringify(vault),
    totalCents: vault.totalCents,
    offerUrl: offer.url ?? null,
  };

  // 1. The Vault's limits are final.
  if (!vault.pass) {
    await seal(m.id, { ...record, outcome: "BLOCKED", reason: vault.line, decidedBy: "agents" });
    await note(m.id, `Blocked ${offer.name}. Still watching.`);
    return;
  }
  // 2. Neither AI wants it: nothing to ask.
  if (!scoutYes && !bankerYes && banker.redFlags.length === 0) {
    await seal(m.id, { ...record, outcome: "SKIPPED", reason: scout.line, decidedBy: "agents" });
    await note(m.id, `Passed on ${offer.name}. Still watching.`);
    return;
  }
  // 3. Everyone agrees. In alert mode, tell the owner and stop; they pay themselves.
  if (scoutYes && bankerYes && m.mode === "ALERT") {
    const d = await seal(m.id, { ...record, outcome: "FOUND", reason: "All three checks passed. Your turn.", decidedBy: "agents" });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "FOUND" } });
    await say(m.id, "STANDBY", `Found it: ${offer.name}. Scout, the Banker and the Vault all agree. Your turn.`, { alert: true, decisionId: d.id });
    return;
  }
  //    In buy mode, pay from the hold.
  if (scoutYes && bankerYes) {
    const d = await seal(m.id, { ...record, outcome: "BUYING", reason: "Both checks said yes.", decidedBy: "agents" });
    await buy(m, d.id, offer.id, quantity, vault, "BOUGHT");
    return;
  }
  // 4. They disagree, or the Banker raised a red flag: the owner decides.
  const d = await seal(m.id, { ...record, outcome: "NEEDS_YOU", reason: banker.redFlags[0] ?? (scoutYes ? banker.line : scout.line) });
  await prisma.mandate.update({ where: { id: m.id }, data: { status: "NEEDS_YOU", lastCheckedAt: new Date() } });
  await say(m.id, "STANDBY", `The checks disagree about ${offer.name}. Nothing is paid until you decide.`, { alert: true, decisionId: d.id });
}

async function buy(m: Mandate, decisionId: string, offerId: string, quantity: number, vault: VaultResult, outcome: "BOUGHT" | "APPROVED") {
  try {
    const cap = await captureHold(m.paypalAuthorizationId!, vault.totalCents!, decisionId);
    await placeOrder(offerId, quantity, vault.totalCents!, m.id, cap.captureId);
    await prisma.decision.update({
      where: { id: decisionId },
      data: { outcome, paypalCaptureId: cap.captureId, decidedAt: new Date(), reason: outcome === "APPROVED" ? "You approved it." : "Both checks said yes." },
    });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "BOUGHT", lastCheckedAt: new Date() } });
    await say(m.id, "PAYPAL", `Bought for ${money(vault.totalCents!)} from your hold. PayPal capture ${cap.captureId}.`, { alert: true, decisionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PayPal didn't take the payment.";
    await prisma.decision.update({ where: { id: decisionId }, data: { outcome: "FAILED", reason: msg, decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "WATCHING" } });
    await say(m.id, "PAYPAL", `Payment failed: ${msg} Nothing was taken. Still watching.`, { alert: true, decisionId });
  }
}

// ---------- You decide ----------

export async function decide(ownerId: string, decisionId: string, approve: boolean) {
  const d = await prisma.decision.findUnique({ where: { id: decisionId }, include: { mandate: { include: { owner: true } } } });
  if (!d || d.mandate.ownerId !== ownerId) throw new Error("Not found.");
  if (d.outcome !== "NEEDS_YOU") throw new Error("This one is already decided.");
  const m = d.mandate;

  if (!approve) {
    await prisma.decision.update({ where: { id: d.id }, data: { outcome: "DENIED", reason: "You said no.", decidedBy: "you", decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "WATCHING" } });
    await say(m.id, "YOU", `No to ${d.offerLabel}. Keep watching.`, { decisionId: d.id });
    return;
  }

  // The Vault runs again: prices and stock may have changed since the agents looked.
  const scout: ScoutLook = JSON.parse(d.scout);
  const vault = await runVault(m.owner, { ...m, status: "WATCHING" }, d.offerId, scout.quantity, JSON.parse(d.snapshot));
  if (!vault.pass) {
    await prisma.decision.update({ where: { id: d.id }, data: { outcome: "BLOCKED", reason: vault.line, vault: JSON.stringify(vault), decidedBy: "you", decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "WATCHING" } });
    await say(m.id, "VAULT", `You said yes, but I blocked it on a second look: ${vault.line}`, { decisionId: d.id });
    return;
  }
  await prisma.decision.update({ where: { id: d.id }, data: { decidedBy: "you", vault: JSON.stringify(vault), totalCents: vault.totalCents } });
  if (m.mode === "ALERT") {
    // Alert mode never pays by itself: your yes turns it into a find for you to buy.
    await prisma.decision.update({ where: { id: d.id }, data: { outcome: "FOUND", reason: "You said it's the one. Your turn to buy." } });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "FOUND" } });
    await say(m.id, "YOU", `Yes, ${d.offerLabel} is the one. I'll buy it myself.`, { decisionId: d.id });
    return;
  }
  await say(m.id, "YOU", `Yes, buy ${d.offerLabel}.`, { decisionId: d.id, note: false });
  await buy(m, d.id, d.offerId, scout.quantity, vault, "APPROVED");
}

// ---------- Alert mode: after a find, you buy it (or don't) ----------

export async function foundAction(ownerId: string, decisionId: string, action: "bought" | "pass") {
  const d = await prisma.decision.findUnique({ where: { id: decisionId }, include: { mandate: true } });
  if (!d || d.mandate.ownerId !== ownerId) throw new Error("Not found.");
  if (d.outcome !== "FOUND") throw new Error("This one is already settled.");
  if (action === "bought") {
    await prisma.decision.update({ where: { id: d.id }, data: { outcome: "YOU_BOUGHT", reason: "You bought it yourself.", decidedBy: "you", decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: d.mandateId }, data: { status: "BOUGHT" } });
    await say(d.mandateId, "YOU", "I bought it myself. Watch finished.", { decisionId: d.id });
  } else {
    await prisma.decision.update({ where: { id: d.id }, data: { outcome: "PASSED", reason: "You said not this one.", decidedBy: "you", decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: d.mandateId }, data: { status: "WATCHING" } });
    await say(d.mandateId, "YOU", `Not this one. Keep watching.`, { decisionId: d.id });
  }
}

// Alert mode on a store that takes PayPal: you approve this one payment yourself, then it's captured.
export async function completeAlertPayment(decisionId: string, captureId: string) {
  const d = await prisma.decision.findUniqueOrThrow({ where: { id: decisionId }, include: { mandate: true } });
  const scout: ScoutLook = JSON.parse(d.scout);
  await placeOrder(d.offerId, scout.quantity, d.totalCents ?? 0, d.mandateId, captureId);
  await prisma.decision.update({
    where: { id: d.id },
    data: { outcome: "APPROVED", reason: "You approved and paid with PayPal.", paypalCaptureId: captureId, decidedBy: "you", decidedAt: new Date() },
  });
  await prisma.mandate.update({ where: { id: d.mandateId }, data: { status: "BOUGHT" } });
  await say(d.mandateId, "PAYPAL", `You paid ${money(d.totalCents ?? 0)} with PayPal. Capture ${captureId}.`, { alert: true, decisionId: d.id });
}

// Paused by time, visit limit or the store: the hold is released, and the owner can reactivate with a new one.
export async function pauseWatch(m: Mandate, reason: "DEADLINE" | "VISIT_LIMIT" | "STORE_CLOSED", text: string) {
  if (m.paypalAuthorizationId) await releaseHold(m.paypalAuthorizationId).catch(() => {});
  await prisma.mandate.update({
    where: { id: m.id },
    data: { status: "PAUSED", pausedReason: reason, paypalAuthorizationId: null, heldCents: null },
  });
  await say(m.id, "SCOUT", text, { alert: true });
}

export async function endWatch(m: Mandate, text: string) {
  if (m.paypalAuthorizationId && m.status !== "BOUGHT") {
    await releaseHold(m.paypalAuthorizationId).catch(() => {});
  }
  await prisma.mandate.update({ where: { id: m.id }, data: { status: "ENDED", lastCheckedAt: new Date() } });
  await say(m.id, "YOU", "End this watch, please.");
  await note(m.id, text);
}

// ---------- Sealed record: each decision carries a hash of the one before it ----------

type DecisionInput = {
  offerUrl?: string | null;
  offerId: string;
  offerLabel: string;
  snapshot: string;
  scout: string;
  banker?: string;
  vault?: string;
  outcome: string;
  reason: string;
  totalCents?: number | null;
  decidedBy?: string;
};

async function seal(mandateId: string, input: DecisionInput) {
  const last = await prisma.decision.findFirst({ where: { mandateId }, orderBy: { seq: "desc" } });
  const seq = (last?.seq ?? 0) + 1;
  const prevSeal = last?.seal ?? "genesis";
  const createdAt = new Date();
  const seal = createHash("sha256")
    .update(JSON.stringify({ prevSeal, seq, mandateId, offerId: input.offerId, snapshot: input.snapshot, scout: input.scout, banker: input.banker ?? null, at: createdAt.toISOString() }))
    .digest("hex");
  return prisma.decision.create({
    data: {
      ...input,
      mandateId,
      seq,
      createdAt,
      prevSeal,
      seal,
      decidedAt: input.decidedBy ? createdAt : null,
    },
  });
}

export type { BankerReview, ScoutLook };
