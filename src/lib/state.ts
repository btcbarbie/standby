import { prisma } from "./prisma";
import { listingUrl } from "./stores";
import { paypalConfigured } from "./paypal";
import { agentRef, declaration, effectivePaceSec } from "./manners";
import type { ScoutLook, BankerReview } from "./ai";
import type { VaultResult } from "./vault";

// Everything the Standby screens show, in one shape the browser polls.

export async function loadState(ownerId: string, watchId?: string | null) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  const mandates = await prisma.mandate.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { decisions: { orderBy: { seq: "desc" }, take: 1 }, _count: { select: { decisions: true } } },
  });
  const listings = await prisma.listing.findMany({ where: { ownerId } });
  const store = (key: string) => {
    const l = listings.find((x) => x.store === key);
    return l ? listingUrl(key as "tixora" | "wren", l.id) : null;
  };

  const watches = mandates.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    kind: m.kind,
    itemName: m.itemName,
    imageUrl: m.imageUrl,
    store: m.storeName || (m.listingUrl.includes("/tixora/") ? "Tixora" : "Wren"),
    mode: m.mode,
    hidden: m.hidden,
    isDemo: m.isDemo,
    listingUrl: m.listingUrl,
    maxTotalCents: m.maxTotalCents,
    quantity: m.quantity,
    expiresAt: m.expiresAt.toISOString(),
    notBefore: m.notBefore?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    lastCheckedAt: m.lastCheckedAt?.toISOString() ?? null,
    lastNote: m.lastNote,
    pausedReason: m.pausedReason,
    visits: m.visits,
    maxVisits: m.maxVisits,
    paceSec: effectivePaceSec(m),
    storePolicy: m.storePolicy,
    days: m.days,
    backoffUntil: m.backoffUntil?.toISOString() ?? null,
    looked: m._count.decisions,
    last: m.decisions[0]
      ? { outcome: m.decisions[0].outcome, reason: m.decisions[0].reason, offerLabel: m.decisions[0].offerLabel, at: m.decisions[0].createdAt.toISOString() }
      : null,
  }));

  let detail = null;
  if (watchId) {
    const m = await prisma.mandate.findUnique({
      where: { id: watchId },
      include: { decisions: { orderBy: { seq: "desc" } }, events: { orderBy: { at: "desc" }, take: 200 } },
    });
    if (m && m.ownerId === ownerId) {
      detail = {
        id: m.id,
        wants: m.wants,
        mustHave: JSON.parse(m.mustHave) as string[],
        sellerName: m.sellerName,
        options: m.options ? (JSON.parse(m.options) as string[]) : null,
        heldCents: m.heldCents,
        paypalOrderId: m.paypalOrderId,
        paypalAuthorizationId: m.paypalAuthorizationId,
        holdExpiresAt: m.holdExpiresAt?.toISOString() ?? null,
        declaration: declaration(m).replace(/visit \d+ of (\d+)/, "at most $1 visits"),
        agentRef: agentRef(m.id),
        events: m.events
          .map((e) => ({ id: e.id, at: e.at.toISOString(), lastAt: e.lastAt.toISOString(), count: e.count, who: e.who, text: e.text, decisionId: e.decisionId, alert: e.alert }))
          .reverse(),
        decisions: m.decisions.map((d) => ({
          id: d.id,
          seq: d.seq,
          at: d.createdAt.toISOString(),
          offerLabel: d.offerLabel,
          outcome: d.outcome,
          reason: d.reason,
          totalCents: d.totalCents,
          decidedBy: d.decidedBy,
          paypalCaptureId: d.paypalCaptureId,
          offerUrl: d.offerUrl,
          seal: d.seal,
          scout: JSON.parse(d.scout) as ScoutLook,
          banker: d.banker ? (JSON.parse(d.banker) as BankerReview) : null,
          vault: d.vault ? (JSON.parse(d.vault) as VaultResult) : null,
        })),
      };
    }
  }

  // Important moments you haven't seen yet: a buy, a find, a question for you, a pause.
  const alerts = await prisma.event.findMany({
    where: { alert: true, seenAt: null, mandate: { ownerId } },
    orderBy: { at: "desc" },
    take: 20,
    include: { mandate: { select: { title: true } } },
  });

  return {
    stopped: owner?.stopped ?? false,
    alerts: alerts.map((a) => ({ id: a.id, at: a.at.toISOString(), watchId: a.mandateId, watchTitle: a.mandate.title, who: a.who, text: a.text })),
    paypalReady: paypalConfigured(),
    stores: { tixora: store("tixora"), wren: store("wren") },
    watches,
    detail,
  };
}

export type AppState = Awaited<ReturnType<typeof loadState>>;
export type WatchSummary = AppState["watches"][number];
export type WatchDetail = NonNullable<AppState["detail"]>;
export type DecisionView = WatchDetail["decisions"][number];
export type EventView = WatchDetail["events"][number];
export type AlertView = AppState["alerts"][number];
