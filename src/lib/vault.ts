import type { Mandate, Owner } from "@prisma/client";
import { prisma } from "./prisma";
import { quote } from "./stores";
import { money } from "./format";
import type { PageOffer } from "./page";

// The Vault: hard limits written in code. No AI can argue past these.
// Code checks the numbers and the identity of the item. The AIs check the meaning (left wing, green, size 8).

export const SPEED_LIMIT = { purchases: 3, minutes: 10 };
export const DAILY_LIMIT_CENTS = 50000;

export type VaultCheck = { key: string; label: string; ok: boolean; detail: string };
export type VaultResult = { pass: boolean; checks: VaultCheck[]; totalCents: number | null; line: string };

// Demo stores quote through their checkout (fees included). On a real store the Vault can only use the price
// the page shows; shipping and tax appear at the store's own checkout, which the owner completes themselves.
async function quoteFor(m: Mandate, offerId: string, quantity: number, pageOffer?: PageOffer) {
  if (m.isDemo) return quote(offerId, quantity);
  if (!pageOffer) return null;
  return {
    offerId,
    listingId: m.listingId,
    seller: pageOffer.seller,
    label: pageOffer.name,
    stock: pageOffer.inStock ? quantity : 0,
    unitCents: pageOffer.priceCents,
    feeCents: 0,
    totalCents: pageOffer.priceCents * quantity,
  };
}

// Names are compared as whole phrases, so "Section 10" never matches "Section 104".
function containsPhrase(name: string, phrase: string) {
  const p = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return p.length > 0 && new RegExp(`(^|[^A-Za-z0-9])${p}([^A-Za-z0-9]|$)`, "i").test(name);
}

const LIVE_STATUSES = ["WATCHING", "NEEDS_YOU", "FOUND"];

export async function runVault(owner: Owner, m: Mandate, offerId: string, quantity: number, pageOffer?: PageOffer): Promise<VaultResult> {
  // Never trust copies taken before the AIs started thinking (that can be a minute): re-read the switches now.
  const freshOwner = (await prisma.owner.findUnique({ where: { id: owner.id } })) ?? owner;
  const freshMandate = await prisma.mandate.findUnique({ where: { id: m.id } });
  const status = freshMandate?.status ?? m.status;
  const q = await quoteFor(m, offerId, quantity, pageOffer);
  const checks: VaultCheck[] = [];
  const add = (key: string, label: string, ok: boolean, detail: string) => checks.push({ key, label, ok, detail });

  add(
    "on",
    "Watching is switched on",
    !freshOwner.stopped && LIVE_STATUSES.includes(status),
    freshOwner.stopped ? "Stop all is on." : LIVE_STATUSES.includes(status) ? "Yes." : `This watch is ${status.toLowerCase()}.`,
  );
  add("deadline", "Before the deadline", new Date() < m.expiresAt, `Watch ends ${m.expiresAt.toDateString()}.`);

  if (!q) {
    add("item", "Same item you chose", false, "The store no longer has this offer.");
  } else {
    add("item", "Same item you chose", q.listingId === m.listingId, q.listingId === m.listingId ? m.itemName : "A different product page.");
    add(
      "seller",
      "Seller",
      m.sellerName ? q.seller === m.sellerName : true,
      m.sellerName ? (q.seller === m.sellerName ? `Sold by ${q.seller}.` : `Sold by ${q.seller}, not ${m.sellerName}.`) : `Any seller allowed (${q.seller}).`,
    );
    if (m.mustMatch) {
      // For listings that come and go (tickets): the owner confirmed which names are acceptable, e.g. Section 101–108.
      const allowed: string[] = JSON.parse(m.mustMatch);
      const ok = allowed.some((a) => containsPhrase(q.label, a));
      add("listing", "A listing you allowed", ok, ok ? `${q.label}.` : `${q.label} isn't one of: ${allowed.join(", ")}.`);
    }
    if (m.options) {
      // The owner ticked exact options at setup. Code compares names; no AI judgement involved.
      const picked: string[] = JSON.parse(m.options);
      const name = q.label;
      const ok = picked.includes(name);
      add("option", "The option you picked", ok, ok ? `${name}.` : `${name || "This offer"} isn't one you ticked (${picked.join(", ")}).`);
    }
    add("qty", "Quantity", quantity === m.quantity, quantity === m.quantity ? `${quantity}, as asked.` : `${quantity} asked for, you said ${m.quantity}.`);
    add("stock", "Still available", q.stock >= quantity, q.stock >= quantity ? "In stock." : "Sold out.");
    add(
      "total",
      m.isDemo ? "Total with fees" : "Price on the page",
      q.totalCents <= m.maxTotalCents,
      m.isDemo
        ? `${money(q.totalCents)} vs your limit of ${money(m.maxTotalCents)}${q.feeCents ? ` (includes ${money(q.feeCents * quantity)} in fees)` : ""}.`
        : `${money(q.totalCents)} vs your limit of ${money(m.maxTotalCents)}. Shipping and tax show at the store's checkout.`,
    );
    if (m.mode === "BUY") {
      add(
        "hold",
        "Inside the PayPal hold",
        Boolean(m.paypalAuthorizationId && m.heldCents && q.totalCents <= m.heldCents),
        m.paypalAuthorizationId ? `Hold is ${money(m.heldCents ?? 0)}.` : "No PayPal hold yet.",
      );
    } else {
      add("hold", "Nothing is paid without you", true, "Alert mode: Standby tells you, you decide and pay.");
    }
  }

  // A purchase that is still being paid for counts too, so two can never run at once.
  const done = await prisma.decision.count({ where: { mandateId: m.id, outcome: { in: ["BUYING", "BOUGHT", "APPROVED", "YOU_BOUGHT"] } } });
  add("once", "Only one purchase per watch", done === 0, done === 0 ? "Nothing bought yet." : "Already bought.");

  const since = new Date(Date.now() - SPEED_LIMIT.minutes * 60_000);
  const recent = await prisma.decision.count({
    where: { mandate: { ownerId: owner.id }, outcome: { in: ["BOUGHT", "APPROVED"] }, decidedAt: { gte: since } },
  });
  add("speed", "Speed limit", recent < SPEED_LIMIT.purchases, `${recent} of ${SPEED_LIMIT.purchases} purchases allowed in ${SPEED_LIMIT.minutes} minutes.`);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const spent = await prisma.decision.aggregate({
    _sum: { totalCents: true },
    where: { mandate: { ownerId: owner.id }, outcome: { in: ["BOUGHT", "APPROVED"] }, decidedAt: { gte: dayStart } },
  });
  const spentToday = spent._sum.totalCents ?? 0;
  const total = q?.totalCents ?? 0;
  add("daily", "Daily limit", spentToday + total <= DAILY_LIMIT_CENTS, `${money(spentToday)} spent today, limit ${money(DAILY_LIMIT_CENTS)}.`);

  const failed = checks.filter((c) => !c.ok);
  const pass = failed.length === 0;
  const line = pass
    ? `${q ? money(q.totalCents) : ""} ${m.isDemo ? "total" : "on the page"}, quantity ${quantity}, inside every limit. ${m.mode === "BUY" ? "Open." : "Cleared to tell you."}`.trim()
    : `Locked. ${failed[0].label}: ${failed[0].detail}`;
  return { pass, checks, totalCents: q?.totalCents ?? null, line };
}
