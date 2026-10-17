import { createHash } from "crypto";
import type { Mandate } from "@prisma/client";
import { prisma } from "./prisma";
import { readPage, type PageOffer } from "./page";
import { scoutLook, bankerReview, AiError, type ScoutLook, type BankerReview } from "./ai";
import { runVault, type VaultResult } from "./vault";
import { captureHold, releaseHold, PayPalError } from "./paypal";
import { placeOrder } from "./stores";
import { money } from "./format";

// The watch loop. For each new offer that might fit:
//   1. Scout reads the page and proposes (or skips).
//   2. The Banker reviews the same offer blind, and the Vault runs its rules. Both at once.
//   3. Vault says no -> blocked. Banker and Vault both say yes -> bought. They disagree -> you decide.

const busy = new Set<string>();

export function mustHave(m: Mandate): string[] {
  return JSON.parse(m.mustHave);
}

function offerText(o: PageOffer) {
  return `${o.name} (ref ${o.ref}), listed at ${money(o.priceCents)} by ${o.seller}`;
}

export async function checkMandate(mandateId: string) {
  if (busy.has(mandateId)) return;
  busy.add(mandateId);
  try {
    const m = await prisma.mandate.findUnique({ where: { id: mandateId }, include: { owner: true } });
    if (!m || m.status !== "WATCHING") return;
    if (m.owner.stopped) return;

    if (new Date() > m.expiresAt) {
      await endWatch(m, "The deadline passed without a match. Hold released.");
      return;
    }

    const page = await readPage(m.listingUrl);
    if (page.listingId !== m.listingId) {
      await note(m.id, "The page no longer shows the item you chose. Waiting.");
      return;
    }

    const seen = await prisma.decision.findMany({ where: { mandateId: m.id }, select: { offerId: true, snapshot: true } });
    const seenKeys = new Set(seen.map((d) => `${d.offerId}:${JSON.parse(d.snapshot).priceCents}`));

    const candidates = page.offers
      // Seller is a Vault rule, not a filter, so the Vault can show why another seller's offer was refused.
      .filter((o) => o.inStock)
      .filter((o) => o.priceCents * m.quantity <= m.maxTotalCents)
      .filter((o) => !seenKeys.has(`${o.id}:${o.priceCents}`))
      .sort((a, b) => a.priceCents - b.priceCents);

    if (candidates.length === 0) {
      await note(m.id, `Nothing new under ${money(m.maxTotalCents)}.`);
      return;
    }

    await evaluate(m, candidates[0], page.text);
  } catch (e) {
    const msg = e instanceof AiError || e instanceof PayPalError || e instanceof Error ? e.message : "Something went wrong.";
    await note(mandateId, `Couldn't check just now: ${msg}`).catch(() => {});
  } finally {
    busy.delete(mandateId);
  }
}

async function note(mandateId: string, text: string) {
  await prisma.mandate.update({ where: { id: mandateId }, data: { lastCheckedAt: new Date(), lastNote: text } });
}

async function evaluate(m: Mandate & { owner: { id: string; stopped: boolean; createdAt: Date } }, offer: PageOffer, pageText: string) {
  const checklist = mustHave(m);
  const base = { wants: m.wants, mustHave: checklist, quantity: m.quantity, maxTotalUsd: m.maxTotalCents / 100, offer: offerText(offer), pageText };
  const snapshot = JSON.stringify({ ...offer, priceCents: offer.priceCents, excerpt: pageText.slice(0, 4000) });

  await note(m.id, `Scout is looking at ${offer.name}…`);
  const scout = await scoutLook(base);

  if (!scout.isMatch) {
    await seal(m.id, {
      offerId: offer.id,
      offerLabel: offer.name,
      snapshot,
      scout: JSON.stringify(scout),
      outcome: "SKIPPED",
      reason: scout.line,
      decidedBy: "agents",
    });
    await note(m.id, `Skipped ${offer.name}.`);
    return;
  }

  await note(m.id, `The Banker and the Vault are checking ${offer.name}…`);
  const [banker, vault] = await Promise.all([bankerReview(base), runVault(m.owner, m, offer.id, scout.quantity)]);

  const bankerYes = banker.verdict === "APPROVE" && banker.redFlags.length === 0;

  if (!vault.pass) {
    await seal(m.id, {
      offerId: offer.id,
      offerLabel: offer.name,
      snapshot,
      scout: JSON.stringify(scout),
      banker: JSON.stringify(banker),
      vault: JSON.stringify(vault),
      outcome: "BLOCKED",
      reason: vault.line,
      totalCents: vault.totalCents,
      decidedBy: "agents",
    });
    await note(m.id, `Blocked ${offer.name}. Still watching.`);
    return;
  }

  if (!bankerYes) {
    const reason = banker.redFlags[0] ?? banker.line;
    await seal(m.id, {
      offerId: offer.id,
      offerLabel: offer.name,
      snapshot,
      scout: JSON.stringify(scout),
      banker: JSON.stringify(banker),
      vault: JSON.stringify(vault),
      outcome: "NEEDS_YOU",
      reason,
      totalCents: vault.totalCents,
    });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "NEEDS_YOU", lastCheckedAt: new Date(), lastNote: "The checks disagree. Your call." } });
    return;
  }

  const d = await seal(m.id, {
    offerId: offer.id,
    offerLabel: offer.name,
    snapshot,
    scout: JSON.stringify(scout),
    banker: JSON.stringify(banker),
    vault: JSON.stringify(vault),
    outcome: "BUYING",
    reason: "Both checks said yes.",
    totalCents: vault.totalCents,
    decidedBy: "agents",
  });
  await buy(m, d.id, offer.id, scout.quantity, vault, "BOUGHT");
}

async function buy(m: Mandate, decisionId: string, offerId: string, quantity: number, vault: VaultResult, outcome: "BOUGHT" | "APPROVED") {
  try {
    const cap = await captureHold(m.paypalAuthorizationId!, vault.totalCents!, decisionId);
    await placeOrder(offerId, quantity, vault.totalCents!, m.id, cap.captureId);
    await prisma.decision.update({
      where: { id: decisionId },
      data: { outcome, paypalCaptureId: cap.captureId, decidedAt: new Date(), reason: outcome === "APPROVED" ? "You approved it." : "Both checks said yes." },
    });
    await prisma.mandate.update({
      where: { id: m.id },
      data: { status: "BOUGHT", lastCheckedAt: new Date(), lastNote: `Bought for ${money(vault.totalCents!)}. PayPal capture ${cap.captureId}.` },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PayPal didn't take the payment.";
    await prisma.decision.update({ where: { id: decisionId }, data: { outcome: "FAILED", reason: msg, decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "WATCHING", lastNote: `Payment failed: ${msg}` } });
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
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "WATCHING", lastNote: "You said no. Still watching." } });
    return;
  }

  // The Vault runs again: prices and stock may have changed since the agents looked.
  const scout: ScoutLook = JSON.parse(d.scout);
  const vault = await runVault(m.owner, { ...m, status: "WATCHING" }, d.offerId, scout.quantity);
  if (!vault.pass) {
    await prisma.decision.update({ where: { id: d.id }, data: { outcome: "BLOCKED", reason: vault.line, vault: JSON.stringify(vault), decidedBy: "you", decidedAt: new Date() } });
    await prisma.mandate.update({ where: { id: m.id }, data: { status: "WATCHING", lastNote: "The Vault blocked it on a second look." } });
    return;
  }
  await prisma.decision.update({ where: { id: d.id }, data: { decidedBy: "you", vault: JSON.stringify(vault), totalCents: vault.totalCents } });
  await buy(m, d.id, d.offerId, scout.quantity, vault, "APPROVED");
}

export async function endWatch(m: Mandate, text: string) {
  if (m.paypalAuthorizationId && m.status !== "BOUGHT") {
    await releaseHold(m.paypalAuthorizationId).catch(() => {});
  }
  await prisma.mandate.update({ where: { id: m.id }, data: { status: "ENDED", lastNote: text, lastCheckedAt: new Date() } });
}

// ---------- Sealed record: each decision carries a hash of the one before it ----------

type DecisionInput = {
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
