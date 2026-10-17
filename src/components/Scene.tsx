"use client";

import { useState } from "react";
import Character, { CAST, type Mood, type Who } from "./Character";
import { OutcomeStamp, Button } from "./ui";
import { money } from "@/lib/format";
import TimeAgo from "./TimeAgo";
import type { DecisionView } from "@/lib/state";

// One decision, replayed as a short exchange between the cast.

function Bubble({ who, mood, line, children }: { who: Who; mood: Mood; line: string; children?: React.ReactNode }) {
  const c = CAST[who];
  return (
    <div className="rise flex gap-3">
      <Character who={who} mood={mood} size={44} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold" style={{ color: c.color }}>
          {c.name}
        </div>
        <div className="mt-1 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[15px] leading-snug" style={{ background: c.soft }}>
          {line}
        </div>
        {children}
      </div>
    </div>
  );
}

function Checks({ items }: { items: { label: string; ok: boolean; note?: string; detail?: string }[] }) {
  const [open, setOpen] = useState(false);
  const failed = items.filter((i) => !i.ok).length;
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen(!open)} className="text-xs font-medium text-muted hover:text-ink">
        {open ? "Hide" : "Show"} {items.length} checks{failed ? ` · ${failed} failed` : " · all passed"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 rounded-xl border border-line bg-white p-3 text-sm">
          {items.map((i, n) => (
            <li key={n} className="flex gap-2">
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${i.ok ? "bg-good" : "bg-bad"}`}>{i.ok ? "✓" : "✕"}</span>
              <span>
                <span className="font-medium">{i.label}</span>
                <span className="text-muted"> · {i.note ?? i.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notes({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen(!open)} className="text-xs font-medium text-muted hover:text-ink">
        {open ? "Hide" : "Show"} Scout&apos;s notes
      </button>
      {open && (
        <ul className="mt-2 list-disc space-y-1 rounded-xl border border-line bg-white py-3 pl-7 pr-3 text-sm text-muted">
          {items.map((i, n) => (
            <li key={n}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Scene({ d, onDecide, busy }: { d: DecisionView; onDecide?: (approve: boolean) => void; busy?: boolean }) {
  const scoutMood: Mood = d.outcome === "SKIPPED" ? "calm" : d.outcome === "BLOCKED" || d.outcome === "NEEDS_YOU" ? "thinking" : "happy";
  const bankerMood: Mood = !d.banker ? "calm" : d.banker.verdict === "APPROVE" && d.banker.redFlags.length === 0 ? "happy" : d.banker.redFlags.length ? "alert" : "stern";
  const vaultMood: Mood = !d.vault ? "calm" : d.vault.pass ? "happy" : "stern";

  return (
    <div className="space-y-4">
      <Bubble who="scout" mood={scoutMood} line={d.scout.line}>
        <Notes items={d.scout.reasons} />
      </Bubble>

      {d.banker && (
        <Bubble who="banker" mood={bankerMood} line={d.banker.line}>
          {d.banker.redFlags.length > 0 && (
            <div className="mt-2 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
              <span className="font-semibold">Red flag: </span>
              {d.banker.redFlags.join(" ")}
            </div>
          )}
          {d.banker.elsewhere?.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              <span className="font-semibold">Also noticed elsewhere on the page: </span>
              {d.banker.elsewhere.join(" ")}
            </p>
          )}
          <Checks items={d.banker.checks} />
        </Bubble>
      )}

      {d.vault && (
        <Bubble who="vault" mood={vaultMood} line={d.vault.line}>
          <Checks items={d.vault.checks} />
        </Bubble>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <OutcomeStamp outcome={d.outcome} big />
        <span className="text-sm text-muted">{verdictLine(d)}</span>
      </div>

      {d.outcome === "NEEDS_YOU" && onDecide && (
        <div className="rise flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand-soft/60 p-4 sm:flex-row sm:items-center">
          <Character who="you" size={44} className="shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-semibold">Your call.</div>
            <div className="text-muted">
              {disagreement(d)} Nothing is paid unless you say yes
              {d.totalCents ? `, and then ${money(d.totalCents)} comes out of your PayPal hold` : ""}.
            </div>
          </div>
          <div className="flex gap-2">
            <Button kind="secondary" disabled={busy} onClick={() => onDecide(false)}>
              Don&apos;t buy
            </Button>
            <Button disabled={busy} onClick={() => onDecide(true)}>
              {busy ? "Working…" : "Buy it"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span><TimeAgo at={d.at} /></span>
        {d.paypalCaptureId && <span>PayPal capture {d.paypalCaptureId}</span>}
        <span title={d.seal}>Sealed #{d.seq} · {d.seal.slice(0, 10)}…</span>
      </div>
    </div>
  );
}

function disagreement(d: DecisionView) {
  if (d.banker?.redFlags.length) return "The Vault's limits passed, but the Banker found a red flag.";
  if (d.scout.isMatch) return "The Vault's limits passed and Scout wants it, but the Banker isn't convinced.";
  return "The Vault's limits passed and the Banker approves, but Scout doesn't think it matches.";
}

export function verdictLine(d: DecisionView) {
  switch (d.outcome) {
    case "SKIPPED":
      return "Scout and the Banker both passed on it.";
    case "BLOCKED":
      return "The Vault refused. No money moved.";
    case "NEEDS_YOU":
      return "The checks disagree, so it waits for you.";
    case "BUYING":
      return "Both checks said yes. Paying through PayPal…";
    case "BOUGHT":
      return `Both checks said yes. Paid ${d.totalCents ? money(d.totalCents) : ""} through PayPal.`;
    case "APPROVED":
      return `You approved it. Paid ${d.totalCents ? money(d.totalCents) : ""} through PayPal.`;
    case "DENIED":
      return "You said no. Nothing was paid.";
    case "FAILED":
      return d.reason;
    default:
      return d.reason;
  }
}
