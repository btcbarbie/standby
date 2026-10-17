"use client";

import Link from "next/link";
import { useState } from "react";
import Character from "./Character";
import Scene, { verdictLine } from "./Scene";
import { AppHeader, Button, Card, OutcomeStamp, StatusPill } from "./ui";
import StopAll from "./StopAll";
import { usePoll } from "@/lib/usePoll";
import { money, ago, shortDate } from "@/lib/format";
import type { AppState } from "@/lib/state";

export default function WatchView({ id, initial }: { id: string; initial: AppState }) {
  const { state, refresh } = usePoll(initial, id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const w = state.watches.find((x) => x.id === id)!;
  const d = state.detail!;
  if (!w || !d) return null;

  const pending = d.decisions.find((x) => x.outcome === "NEEDS_YOU");
  const latest = d.decisions[0];
  const featured = pending ?? latest;
  const rest = d.decisions.filter((x) => x.id !== featured?.id);
  const working = w.status === "WATCHING" && /looking|checking/.test(w.lastNote ?? "");

  async function act(action: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/watches/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) setError((await res.json()).error);
    setBusy(false);
    refresh();
  }

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/decisions/${pending!.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve }) });
    if (!res.ok) setError((await res.json()).error);
    setBusy(false);
    refresh();
  }

  return (
    <div className="min-h-screen">
      <AppHeader right={<StopAll stopped={state.stopped} onChange={refresh} />} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        <Link href="/app" className="text-sm font-medium text-muted hover:text-ink">
          ← Your watches
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Character who="scout" mood={w.status === "BOUGHT" ? "happy" : pending ? "alert" : working ? "thinking" : "calm"} size={64} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{w.title}</h1>
                <StatusPill status={w.status} />
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {w.itemName} on {w.store} ·{" "}
                <a href={w.listingUrl} target="_blank" rel="noreferrer" className="font-medium text-brand">
                  Open the page ↗
                </a>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {w.status === "WATCHING" && (
              <>
                <Button kind="secondary" disabled={busy} onClick={() => act("check")}>
                  Check now
                </Button>
                <Button kind="secondary" disabled={busy} onClick={() => act("pause")}>
                  Pause
                </Button>
              </>
            )}
            {w.status === "PAUSED" && (
              <Button kind="secondary" disabled={busy} onClick={() => act("resume")}>
                Resume
              </Button>
            )}
            {!["BOUGHT", "ENDED"].includes(w.status) && (
              <Button kind="danger" disabled={busy} onClick={() => confirm("End this watch and release the PayPal hold?") && act("end")}>
                End watch
              </Button>
            )}
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0 space-y-4">
            <LiveLine w={w} working={working} stopped={state.stopped} />

            {featured ? (
              <Card className={`p-5 ${pending ? "border-warn/40 ring-2 ring-warn/15" : ""}`}>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{featured.offerLabel}</h2>
                  <span className="text-xs text-muted">Decision {featured.seq}</span>
                </div>
                <Scene d={featured} onDecide={decide} busy={busy} />
              </Card>
            ) : (
              w.status !== "SETUP" && (
                <Card className="p-6 text-center text-sm text-muted">
                  Nothing has come up yet. When a new offer appears under {money(w.maxTotalCents)}, you&apos;ll see Scout, the Banker and the Vault talk it through here.
                </Card>
              )
            )}

            {rest.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted">Earlier</h3>
                <Card className="divide-y divide-line">
                  {rest.map((x) => (
                    <div key={x.id}>
                      <button onClick={() => setOpenId(openId === x.id ? null : x.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <OutcomeStamp outcome={x.outcome} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="font-medium">{x.offerLabel}</span>
                          <span className="text-muted"> · {verdictLine(x)}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{ago(x.at)}</span>
                      </button>
                      {openId === x.id && (
                        <div className="px-4 pb-5">
                          <Scene d={x} />
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Your words</div>
              <p className="mt-1 text-[15px] leading-snug">“{d.wants}”</p>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">It must be</div>
              <ul className="mt-1 space-y-1 text-sm">
                {d.mustHave.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-good">✓</span>
                    {m}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Character who="vault" size={28} />
                <span className="text-sm font-semibold">Vault limits</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row k="Item" v={w.itemName} />
                <Row k="Seller" v={d.sellerName ? `${d.sellerName} only` : "Any seller"} />
                <Row k="Quantity" v={String(w.quantity)} />
                <Row k="Most in total" v={money(w.maxTotalCents)} />
                <Row k="Watch until" v={shortDate(w.expiresAt)} />
                <Row k="Speed limit" v="3 buys / 10 min" />
                <Row k="Daily limit" v="$500" />
              </dl>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold">PayPal hold</div>
              {d.paypalAuthorizationId ? (
                <dl className="mt-2 space-y-1.5 text-sm">
                  <Row k="Held" v={money(d.heldCents ?? 0)} />
                  <Row k="Authorization" v={d.paypalAuthorizationId} mono />
                  {d.holdExpiresAt && <Row k="Hold ends" v={shortDate(d.holdExpiresAt)} />}
                </dl>
              ) : (
                <p className="mt-1 text-sm text-muted">Not approved yet. Nothing is held and nothing can be bought.</p>
              )}
              <p className="mt-3 text-xs text-muted">Only the amount actually spent is taken. Anything left is released.</p>
            </Card>

            <p className="px-1 text-xs text-muted">
              {d.decisions.length} decision{d.decisions.length === 1 ? "" : "s"} recorded. Each is sealed to the one before it, so later changes show.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function LiveLine({ w, working, stopped }: { w: AppState["watches"][number]; working: boolean; stopped: boolean }) {
  let text = w.lastNote ?? "";
  if (w.status === "SETUP") text = w.lastNote ?? "Waiting for you to approve the PayPal hold.";
  if (stopped) text = "Stop all is on. Scout keeps still until you switch it back on.";
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm ring-1 ring-line">
      {w.status === "WATCHING" && !stopped && <span className={`h-2 w-2 shrink-0 rounded-full bg-brand ${working ? "pulse-dot" : ""}`} />}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {w.status === "WATCHING" && <span className="shrink-0 text-xs text-muted">checked {ago(w.lastCheckedAt)}</span>}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`text-right ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}
