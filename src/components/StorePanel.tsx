"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEMO_EVENTS, type StoreKey } from "@/lib/demoEvents";
import TimeAgo from "./TimeAgo";

// Not part of the store. Two tabs for the demo:
//  - make something happen on the page (as a seller would), and
//  - the store owner's view of the AI agents visiting this page.

type Visitors = {
  policy: "WELCOME" | "SLOW" | "CLOSED";
  lastHour: number;
  agents: { ref: string; agent: string; declared: string; visits: number; verified: boolean; signedBy: string | null; first: string; last: string }[];
};

const POLICIES: { key: Visitors["policy"]; label: string; hint: string }[] = [
  { key: "WELCOME", label: "Welcome", hint: "Agents that sign their visits may visit." },
  { key: "SLOW", label: "Slow down", hint: "One visit a minute per agent." },
  { key: "CLOSED", label: "Closed to AI", hint: "Agents should not visit." },
];

export default function StorePanel({ store, listingId }: { store: StoreKey; listingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"events" | "visitors">("events");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<Visitors | null>(null);

  const loadVisitors = useCallback(async () => {
    const res = await fetch(`/api/store/visitors?listing=${listingId}`, { cache: "no-store" });
    if (res.ok) setVisitors(await res.json());
  }, [listingId]);

  useEffect(() => {
    if (tab !== "visitors" || !open) return;
    const first = setTimeout(loadVisitors, 0);
    const t = setInterval(loadVisitors, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [tab, open, loadVisitors]);

  async function run(key: string, title: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That didn't work.");
      setDone(title);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  async function setPolicy(policy: Visitors["policy"]) {
    setBusy(policy);
    await fetch("/api/store/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, policy }) });
    await loadVisitors();
    setBusy(null);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="w-full max-w-3xl rounded-2xl border border-[#d8dce5] bg-white text-[#0e1525] shadow-[0_12px_40px_rgba(14,21,37,0.25)]">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <span className="mr-2 rounded-md bg-[#0e1525] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>
            {(
              [
                ["events", "Make something happen"],
                ["visitors", "AI visitors (store owner's view)"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  setOpen(true);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${tab === key && open ? "bg-[#f4f5f7]" : "text-[#5a6478] hover:text-[#0e1525]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setOpen(!open)} className="text-xs text-[#5a6478]">
            {open ? "Hide" : "Show"}
          </button>
        </div>

        {open && tab === "events" && (
          <div className="border-t border-[#eceef2] px-4 pb-4 pt-3">
            <p className="text-xs text-[#5a6478]">Not part of the store. Each button changes this page the way a seller would. Agents notice on their next visit.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO_EVENTS.filter((e) => e.store === store).map((e) => (
                <button
                  key={e.key}
                  disabled={busy !== null}
                  onClick={() => run(e.key, e.title)}
                  className="rounded-xl border border-[#e4e7ec] px-3 py-2 text-left transition hover:border-[#0e1525] disabled:opacity-50"
                >
                  <span className="block text-sm font-medium">{busy === e.key ? "Listing…" : e.title}</span>
                  <span className="block text-xs text-[#5a6478]">{e.hint}</span>
                </button>
              ))}
            </div>
            {(done || error) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                {error ? <span className="text-[#b42318]">{error}</span> : <span>Done: {done}.</span>}
                <Link href="/app" className="font-semibold text-[#1f4fd8]">
                  Watch your agents in Standby →
                </Link>
              </div>
            )}
          </div>
        )}

        {open && tab === "visitors" && (
          <div className="border-t border-[#eceef2] px-4 pb-4 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5a6478]">Your rules for AI shopping agents</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {POLICIES.map((p) => (
                <button
                  key={p.key}
                  disabled={busy !== null}
                  onClick={() => setPolicy(p.key)}
                  className={`rounded-xl border px-3 py-2 text-left ${visitors?.policy === p.key ? "border-[#0e1525] bg-[#f4f5f7]" : "border-[#e4e7ec] hover:border-[#0e1525]"}`}
                >
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="block text-xs text-[#5a6478]">{p.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm">
              {!visitors ? (
                <span className="text-[#5a6478]">Loading…</span>
              ) : visitors.agents.length === 0 ? (
                <span className="text-[#5a6478]">No AI agents have visited this page yet.</span>
              ) : (
                <>
                  <div className="text-[#5a6478]">
                    {visitors.agents.length} agent{visitors.agents.length > 1 ? "s" : ""} on this page · {visitors.lastHour} visits in the last hour · no other pages visited
                  </div>
                  <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto">
                    {visitors.agents.map((a) => (
                      <li key={a.ref} className="rounded-xl border border-[#e4e7ec] px-3 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="flex flex-wrap items-center gap-2 font-semibold">
                            {a.agent.split(" ")[0]} <span className="font-normal text-[#5a6478]">· {a.ref}</span>
                            {a.verified ? (
                              <span className="rounded-full bg-[#dcfae6] px-2 py-0.5 text-xs font-semibold text-[#067647]" title="Web Bot Auth signature checked against the operator's published key">
                                ✓ Verified · signed by {a.signedBy}
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#fee4e2] px-2 py-0.5 text-xs font-semibold text-[#b42318]" title="No valid Web Bot Auth signature">
                                ✕ Not verified · can&apos;t prove who it is
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-[#5a6478]">
                            {a.visits} visit{a.visits > 1 ? "s" : ""} · last <TimeAgo at={a.last} />
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {a.declared.split("; ").map((d) => (
                            <span key={d} className="rounded-md bg-[#f4f5f7] px-1.5 py-0.5 text-xs text-[#344054]">
                              {d.replace(/visit \d+ of (\d+)/, "at most $1 visits")}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
