"use client";

import { useEffect, useRef } from "react";
import Character, { CAST, type Who } from "./Character";
import Scene from "./Scene";
import TimeAgo from "./TimeAgo";
import type { DecisionView, EventView } from "@/lib/state";

// The watch's whole conversation, oldest first, like a chat: every check Scout made, every round where
// Scout, the Banker and the Vault weighed an offer, what PayPal did, and what you said. Kept, so you can
// come back later and see what happened, what almost happened, and who stopped it.

// "{t:2026-10-20T13:00:00.000Z}" in a message is a moment, shown in your own time zone.
export function withTimes(text: string) {
  return text.replace(/\{t:([^}]+)\}/g, (_, iso) =>
    new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
  );
}

type Item = { kind: "event"; at: string; e: EventView } | { kind: "round"; at: string; d: DecisionView };

const CAST_OF: Record<string, Who | null> = { SCOUT: "scout", BANKER: "banker", VAULT: "vault", YOU: "you", PAYPAL: null, STANDBY: null };

export default function Conversation({
  events,
  decisions,
  mode,
  working,
  waitingOn,
}: {
  events: EventView[];
  decisions: DecisionView[];
  mode: string;
  working: boolean;
  waitingOn?: string | null;
}) {
  const items: Item[] = [
    ...events.map((e) => ({ kind: "event" as const, at: e.at, e })),
    ...decisions.map((d) => ({ kind: "round" as const, at: d.at, d })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // Stay at the newest message, unless you've scrolled up to read.
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const count = items.length + (working ? 1 : 0);
  useEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white" aria-labelledby="convo-title">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="convo-title" className="font-semibold">
            Conversation
          </h2>
          <p className="text-xs text-muted">Everything Scout, the Banker and the Vault said, kept for you.</p>
        </div>
        <div className="flex -space-x-2" aria-hidden>
          {(["scout", "banker", "vault"] as const).map((w) => (
            <Character key={w} who={w} size={28} className="rounded-full bg-white ring-2 ring-white" />
          ))}
        </div>
      </div>

      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="max-h-[70vh] space-y-4 overflow-y-auto bg-bg/40 px-4 py-5"
        aria-live="polite"
      >
        {items.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing said yet. Scout&apos;s first check will show up here.</p>}

        {items.map((it) =>
          it.kind === "round" ? (
            <Round key={it.d.id} d={it.d} mode={mode} />
          ) : (
            <Message key={it.e.id} e={it.e} />
          ),
        )}

        {waitingOn && (
          <p className="text-center text-xs font-semibold text-warn">↑ {waitingOn} is waiting for you at the top of the page.</p>
        )}

        {working && (
          <div className="flex items-center gap-2.5">
            <Character who="scout" mood="thinking" size={32} className="shrink-0" />
            <div className="flex gap-1 rounded-2xl rounded-tl-md bg-scout-soft px-3.5 py-3" aria-label="Scout is checking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#9a5d00]" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Message({ e }: { e: EventView }) {
  const who = CAST_OF[e.who];
  const text = withTimes(e.text);
  const when = (
    <span className="text-[11px] text-muted">
      {e.count > 1 ? (
        <>
          {e.count} times · latest <TimeAgo at={e.lastAt} />
        </>
      ) : (
        <TimeAgo at={e.at} />
      )}
    </span>
  );

  if (e.who === "YOU") {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[80%] text-right">
          <div className="text-xs font-semibold" style={{ color: CAST.you.color }}>
            You
          </div>
          <div className="mt-1 rounded-2xl rounded-tr-md px-3.5 py-2.5 text-left text-[15px] leading-snug" style={{ background: CAST.you.soft }}>
            {text}
          </div>
          {when}
        </div>
        <Character who="you" size={32} className="shrink-0" />
      </div>
    );
  }

  if (!who) {
    // PayPal and Standby itself: short notices in the middle of the chat. Alerts stand out.
    const paypal = e.who === "PAYPAL";
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <div
          className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-sm ${
            e.alert ? (paypal ? "bg-[#0070e0] text-white" : "border border-warn/30 bg-warn-soft font-medium text-ink") : "bg-white text-muted ring-1 ring-line"
          }`}
        >
          {paypal && <span className="mr-1.5 font-bold">PayPal</span>}
          {text}
        </div>
        {when}
      </div>
    );
  }

  const c = CAST[who];
  return (
    <div className="flex gap-2.5">
      <Character who={who} size={32} className="shrink-0" />
      <div className="min-w-0 max-w-[85%]">
        <div className="text-xs font-semibold" style={{ color: c.color }}>
          {c.name}
        </div>
        <div className="mt-1 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[15px] leading-snug" style={{ background: c.soft }}>
          {text}
        </div>
        {when}
      </div>
    </div>
  );
}

// One offer, weighed by all three: Scout proposes, the Banker reviews blind, the Vault checks its limits.
function Round({ d, mode }: { d: DecisionView; mode: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
        <span className="text-sm font-semibold">{d.offerLabel}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Round {d.seq}</span>
      </div>
      <Scene d={d} mode={mode} />
    </div>
  );
}
