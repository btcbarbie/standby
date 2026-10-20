import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { AppHeader, Card } from "@/components/ui";
import TimeAgo from "@/components/TimeAgo";
import Character from "@/components/Character";

export const dynamic = "force-dynamic";

// Every purchase, kept for good: what was bought, for how much, how it was paid and PayPal's own reference.
// Hiding a watch from the dashboard never removes it from here.
const HOW: Record<string, string> = {
  BOUGHT: "Standby paid from your PayPal hold (all three checks agreed)",
  APPROVED: "Paid with PayPal after you said yes",
  YOU_BOUGHT: "You bought it yourself on the store's checkout",
};

export default async function PurchasesPage() {
  const owner = await requireOwner("/app/purchases");
  const rows = await prisma.decision.findMany({
    where: { outcome: { in: Object.keys(HOW) }, mandate: { ownerId: owner.id } },
    orderBy: { decidedAt: "desc" },
    include: { mandate: { select: { id: true, title: true, itemName: true, storeName: true, listingUrl: true, isDemo: true } } },
  });
  const viaPayPal = rows.filter((r) => r.paypalCaptureId);
  const spent = viaPayPal.reduce((n, r) => n + (r.totalCents ?? 0), 0);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <Link href="/app" className="text-sm font-medium text-muted hover:text-ink">
          ← Your watches
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Purchases</h1>
        <p className="mt-1 text-muted">Every buy, kept on record, even for watches you&apos;ve removed from your dashboard.</p>

        {rows.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Purchases</div>
              <div className="tabular mt-1 text-2xl font-semibold">{rows.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Paid through PayPal</div>
              <div className="tabular mt-1 text-2xl font-semibold">{money(spent)}</div>
            </Card>
          </div>
        )}

        {rows.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center px-6 py-10 text-center">
            <Character who="vault" mood="calm" size={64} />
            <h2 className="mt-4 font-semibold">No purchases yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">When Standby buys something for you, or you buy a find yourself, the receipt lands here.</p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{r.offerLabel}</div>
                      <div className="mt-0.5 text-sm text-muted">
                        {r.mandate.itemName} · {r.mandate.storeName || "Demo store"}
                        {r.mandate.isDemo ? " (demo)" : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular text-lg font-semibold">{r.totalCents != null ? money(r.totalCents) : "—"}</div>
                      <div className="text-xs text-muted">
                        <TimeAgo at={(r.decidedAt ?? r.createdAt).toISOString()} />
                      </div>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">How</dt>
                      <dd className="text-right">{HOW[r.outcome]}</dd>
                    </div>
                    {r.paypalCaptureId && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">PayPal capture</dt>
                        <dd className="font-mono text-xs">{r.paypalCaptureId}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Record</dt>
                      <dd className="font-mono text-xs" title={r.seal}>
                        Sealed #{r.seq} · {r.seal.slice(0, 10)}…
                      </dd>
                    </div>
                  </dl>
                  <Link href={`/app/w/${r.mandate.id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
                    See how it was decided →
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
