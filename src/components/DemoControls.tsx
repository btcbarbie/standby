"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEMO_EVENTS, type StoreKey } from "@/lib/demoEvents";

// Not part of the store: a panel for judges to make things happen on the page while their agent watches.
export default function DemoControls({ store }: { store: StoreKey }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="w-full max-w-3xl rounded-2xl border border-[#d8dce5] bg-white text-[#0e1525] shadow-[0_12px_40px_rgba(14,21,37,0.25)]">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-[#0e1525] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>
            Make something happen on this store
          </span>
          <span className="text-xs text-[#5a6478]">{open ? "Hide" : "Show"}</span>
        </button>
        {open && (
          <div className="border-t border-[#eceef2] px-4 pb-4 pt-3">
            <p className="text-xs text-[#5a6478]">Not part of the store. Each button changes this page the way a seller would. Your agents notice within seconds.</p>
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
      </div>
    </div>
  );
}
