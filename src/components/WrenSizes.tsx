"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// The demo store's owner view of the size list: tap sizes to change what's in stock, then OK.
// Only this visitor's copy of the store changes. Agents see it on their next visit.

type Stock = Record<string, boolean>;
const keyOf = (color: string, size: string) => `${color}|${size}`;

export default function WrenSizes({
  listingId,
  colors,
  sizes,
  swatch,
  stock,
}: {
  listingId: string;
  colors: string[];
  sizes: string[];
  swatch: Record<string, string>;
  stock: Stock;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function toggle(k: string) {
    setSaved(null);
    setError(null);
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  const describe = (k: string) => {
    const [color, size] = k.split("|");
    return `${color} / ${size} ${stock[k] ? "sold out" : "in stock"}`;
  };

  async function save() {
    setBusy(true);
    setError(null);
    const changes = picked.map((k) => {
      const [color, size] = k.split("|");
      return { color, size, inStock: !stock[k] };
    });
    const res = await fetch("/api/store/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, changes }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "That didn't work.");
      return;
    }
    setSaved(picked.map(describe).join(", "));
    setPicked([]);
    router.refresh();
  }

  return (
    <div className="mt-8" style={{ fontFamily: "var(--font-sans)" }}>
      <p className="rounded-md bg-[#0e1525]/5 px-3 py-2 text-xs text-black/70">
        <span className="mr-1.5 rounded bg-[#0e1525] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>
        Tap a size to change what&apos;s in stock, then press OK. Only your copy of this store changes.
      </p>

      <div className="mt-5 space-y-6">
        {colors.map((c) => (
          <div key={c}>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: swatch[c] }} />
              <span className="font-medium">{c}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const k = keyOf(c, s);
                const on = picked.includes(k);
                const willStock = on ? !stock[k] : !!stock[k];
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${c} size ${s}: ${stock[k] ? "in stock" : "sold out"}`}
                    onClick={() => toggle(k)}
                    className={`min-w-12 cursor-pointer rounded-sm border px-3 py-2 text-center text-sm transition ${
                      willStock ? "border-black/70 bg-white" : "border-black/10 text-black/30 line-through"
                    } ${on ? "outline-2 outline-offset-2 outline-[#1f4fd8]" : "hover:border-black"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {picked.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#1f4fd8]/30 bg-white px-3 py-2.5">
          <span className="min-w-0 flex-1 text-sm">{picked.map(describe).join(", ")}</span>
          <span className="flex shrink-0 gap-2">
            <button type="button" disabled={busy} onClick={() => setPicked([])} className="rounded-md px-3 py-1.5 text-sm font-medium text-black/60 hover:text-black disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={save} className="rounded-md bg-[#0e1525] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "OK"}
            </button>
          </span>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-[#b42318]">{error}</p>}
      {saved && (
        <p className="mt-3 text-sm">
          Done: {saved}. Agents see this on their next visit.{" "}
          <Link href="/app" className="font-semibold text-[#1f4fd8]">
            Watch your agents in Standby →
          </Link>
        </p>
      )}
    </div>
  );
}
