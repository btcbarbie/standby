"use client";

import { useState } from "react";
import Link from "next/link";
import Character, { CAST, type Mood, type Who } from "./Character";
import { AppHeader, Card, StatusPill, OutcomeStamp } from "./ui";
import StopAll from "./StopAll";
import AlertBell from "./AlertBell";
import { withTimes } from "./Conversation";
import { usePoll } from "@/lib/usePoll";
import { money, shortDate } from "@/lib/format";
import TimeAgo from "./TimeAgo";
import type { AppState, WatchSummary } from "@/lib/state";

function scoutMood(w: WatchSummary): Mood {
  if (w.status === "BOUGHT") return "happy";
  if (w.status === "NEEDS_YOU") return "alert";
  if (w.lastNote?.includes("looking") || w.lastNote?.includes("checking")) return "thinking";
  return "calm";
}

export default function Home({ initial }: { initial: AppState }) {
  const { state, refresh } = usePoll(initial);
  const watches = state.watches;
  const active = watches.filter((w) => ["WATCHING", "NEEDS_YOU", "PAUSED", "SETUP"].includes(w.status));
  const past = watches.filter((w) => ["BOUGHT", "ENDED"].includes(w.status) && !w.hidden);
  const hidden = watches.filter((w) => w.hidden);
  const [showHidden, setShowHidden] = useState(false);

  // Hiding only takes a finished watch off this page. Its record and any purchase are kept.
  async function setHidden(id: string, hide: boolean) {
    await fetch(`/api/watches/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: hide ? "hide" : "unhide" }) });
    refresh();
  }
  const needsYou = watches.filter((w) => w.status === "NEEDS_YOU").length;
  const watching = watches.filter((w) => w.status === "WATCHING").length;
  const looked = watches.reduce((n, w) => n + w.looked, 0);

  const duty: { who: Who; mood: Mood; text: string }[] = [
    { who: "scout", mood: watching ? "thinking" : "calm", text: watching ? `Watching ${watching} page${watching > 1 ? "s" : ""}` : "Ready when you are" },
    { who: "banker", mood: "calm", text: looked ? `${looked} offer${looked > 1 ? "s" : ""} looked at so far` : "Nothing to review yet" },
    { who: "vault", mood: state.stopped ? "stern" : "calm", text: state.stopped ? "Locked: Stop all is on" : "$500 a day · 3 buys per 10 min" },
    { who: "you", mood: "calm", text: needsYou ? `${needsYou} waiting for your yes` : "Nothing needs you" },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader
        right={
          <>
            <AlertBell alerts={state.alerts} onSeen={refresh} />
            <StopAll stopped={state.stopped} onChange={refresh} />
          </>
        }
      />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
        {state.stopped && (
          <div className="mb-6 rounded-2xl border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
            <span className="font-semibold">Stop all is on.</span> No agent can buy anything until you switch it back on.
          </div>
        )}

        {state.alerts.length > 0 && (
          <section className="mb-6 space-y-2" aria-label="New alerts">
            {state.alerts.slice(0, 3).map((a) => (
              <Link
                key={a.id}
                href={`/app/w/${a.watchId}`}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:shadow-sm ${a.who === "PAYPAL" ? "border-[#0070e0]/30 bg-[#e8f1fd]" : "border-warn/30 bg-warn-soft"}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-bad" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{a.watchTitle}: </span>
                  {withTimes(a.text)}
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand">Open →</span>
              </Link>
            ))}
          </section>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your watches</h1>
            <p className="mt-1 text-muted">Things you want, waited for. Bought only when the checks agree.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/purchases" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:border-ink">
              Purchases
            </Link>
            <Link href="/app/new" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
              + New watch
            </Link>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {duty.map((d) => (
            <Card key={d.who} className="flex items-center gap-3 p-3">
              <Character who={d.who} mood={d.mood} size={44} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: CAST[d.who].color }}>
                  {CAST[d.who].name}
                </div>
                <div className="line-clamp-2 text-xs leading-snug text-muted">{d.text}</div>
              </div>
            </Card>
          ))}
        </section>

        {watches.length === 0 ? (
          <Empty stores={state.stores} />
        ) : (
          <>
            <section className="mt-8 space-y-3">
              {active.map((w) => (
                <WatchRow key={w.id} w={w} />
              ))}
              {active.length === 0 && <p className="text-sm text-muted">Nothing being watched right now.</p>}
            </section>
            {past.length > 0 && (
              <section className="mt-10">
                <h2 className="text-sm font-semibold text-muted">Finished</h2>
                <div className="mt-3 space-y-3">
                  {past.map((w) => (
                    <WatchRow
                      key={w.id}
                      w={w}
                      action={
                        <button
                          type="button"
                          onClick={() => setHidden(w.id, true)}
                          aria-label={`Remove “${w.title}” from your dashboard`}
                          title="Remove from dashboard (kept on record)"
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-muted transition hover:border-ink hover:text-ink"
                        >
                          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
                            <path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                            <circle cx="10" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M3.5 16.5l13-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      }
                    />
                  ))}
                </div>
              </section>
            )}
            {hidden.length > 0 && (
              <section className="mt-6">
                <button type="button" onClick={() => setShowHidden(!showHidden)} className="text-sm font-medium text-muted hover:text-ink" aria-expanded={showHidden}>
                  {showHidden ? "Hide" : "Show"} {hidden.length} removed watch{hidden.length > 1 ? "es" : ""}
                </button>
                {showHidden && (
                  <div className="mt-3 space-y-3 opacity-80">
                    {hidden.map((w) => (
                      <WatchRow
                        key={w.id}
                        w={w}
                        action={
                          <button
                            type="button"
                            onClick={() => setHidden(w.id, false)}
                            className="h-10 shrink-0 rounded-full border border-line bg-white px-3 text-xs font-semibold text-muted hover:border-ink hover:text-ink"
                          >
                            Put back
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <DemoStores stores={state.stores} />
      </main>
    </div>
  );
}

function WatchRow({ w, action }: { w: WatchSummary; action?: React.ReactNode }) {
  const row = (
    <Link href={`/app/w/${w.id}`} className="block min-w-0 flex-1">
      <Card className={`flex items-center gap-4 p-4 transition hover:border-ink/40 ${w.status === "NEEDS_YOU" ? "border-warn/40 ring-2 ring-warn/15" : ""}`}>
        <Character who="scout" mood={scoutMood(w)} size={52} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{w.title}</span>
            <StatusPill status={w.status} reason={w.pausedReason} />
          </div>
          <div className="mt-0.5 truncate text-sm text-muted">
            {w.itemName} · {w.store} · up to {money(w.maxTotalCents)} · {w.mode === "ALERT" ? "Alert me" : "Buy for me"}
          </div>
          <div className="mt-1 truncate text-xs text-muted">
            {w.status === "WATCHING" && <><TimeAgo at={w.lastCheckedAt} prefix="Checked " /> · {w.visits} visits · </>}
            {w.lastNote ?? (w.status === "SETUP" ? "Approve the PayPal hold to start watching." : "")}
          </div>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          {w.last ? (
            <>
              <OutcomeStamp outcome={w.last.outcome} />
              <div className="mt-1 max-w-48 truncate text-xs text-muted">{w.last.offerLabel}</div>
            </>
          ) : (
            <span className="text-xs text-muted">Until {shortDate(w.expiresAt)}</span>
          )}
        </div>
      </Card>
    </Link>
  );
  return action ? (
    <div className="flex items-center gap-2">
      {row}
      {action}
    </div>
  ) : (
    row
  );
}

function Empty({ stores }: { stores: AppState["stores"] }) {
  return (
    <Card className="mt-8 px-6 py-10 text-center">
      <div className="flex justify-center -space-x-3">
        <Character who="scout" mood="happy" size={72} />
        <Character who="banker" mood="calm" size={72} />
        <Character who="vault" mood="calm" size={72} />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Nothing being watched yet</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Paste a link, say exactly what you want, and approve a PayPal hold for the most you&apos;ll spend. Scout waits. The Banker and the Vault decide.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {stores.tixora && (
          <Link href="/app/new?try=ticket" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
            Try it: a concert ticket under $40
          </Link>
        )}
        {stores.wren && (
          <Link href="/app/new?try=dress" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:border-ink">
            Try it: a sold-out dress in your size
          </Link>
        )}
        <Link href="/app/new?try=real" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:border-ink">
          Try it on a real store
        </Link>
      </div>
    </Card>
  );
}

function DemoStores({ stores }: { stores: AppState["stores"] }) {
  return (
    <section className="mt-12 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
      <span className="font-semibold text-ink">Demo stores.</span> Standby is watching two practice websites made for this demo. Open one in a new tab and
      use its demo panel to list new tickets or restock sizes:{" "}
      {stores.tixora && (
        <a className="font-semibold text-brand" href={stores.tixora} target="_blank" rel="noreferrer">
          Tixora (tickets) ↗
        </a>
      )}
      {" · "}
      {stores.wren && (
        <a className="font-semibold text-brand" href={stores.wren} target="_blank" rel="noreferrer">
          Wren (clothing) ↗
        </a>
      )}
    </section>
  );
}
