"use client";

import Link from "next/link";
import Character, { CAST, type Mood, type Who } from "./Character";
import { AppHeader, Card, StatusPill, OutcomeStamp } from "./ui";
import StopAll from "./StopAll";
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
  const past = watches.filter((w) => ["BOUGHT", "ENDED"].includes(w.status));
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
      <AppHeader right={<StopAll stopped={state.stopped} onChange={refresh} />} />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
        {state.stopped && (
          <div className="mb-6 rounded-2xl border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
            <span className="font-semibold">Stop all is on.</span> No agent can buy anything until you switch it back on.
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your watches</h1>
            <p className="mt-1 text-muted">Things you want, waited for. Bought only when the checks agree.</p>
          </div>
          <Link href="/app/new" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
            + New watch
          </Link>
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
                    <WatchRow key={w.id} w={w} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <DemoStores stores={state.stores} />
      </main>
    </div>
  );
}

function WatchRow({ w }: { w: WatchSummary }) {
  return (
    <Link href={`/app/w/${w.id}`} className="block">
      <Card className={`flex items-center gap-4 p-4 transition hover:border-ink/40 ${w.status === "NEEDS_YOU" ? "border-warn/40 ring-2 ring-warn/15" : ""}`}>
        <Character who="scout" mood={scoutMood(w)} size={52} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{w.title}</span>
            <StatusPill status={w.status} />
          </div>
          <div className="mt-0.5 truncate text-sm text-muted">
            {w.itemName} · {w.store} · up to {money(w.maxTotalCents)}
          </div>
          <div className="mt-1 truncate text-xs text-muted">
            {w.status === "WATCHING" && <><TimeAgo at={w.lastCheckedAt} prefix="Checked " /> · </>}
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
