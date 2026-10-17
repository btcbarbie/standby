"use client";

import Link from "next/link";
import { useState } from "react";
import Character from "./Character";
import { AppHeader, Button, Card } from "./ui";
import type { Draft } from "@/lib/ai";

type Item = { url: string; listingId: string; name: string; kind: string; store: string; storeSeller: string | null };

const PRESETS = {
  ticket: { wants: "One ticket for the Nova Adé show, left wing only, under $40 including fees. Just one ticket, never more." },
  dress: { wants: "The Ada wrap dress in green, size 8. Only from Wren itself, and no more than $70 with shipping." },
};

export default function NewWatch({
  stores,
  paypalReady,
  preset,
  origin,
}: {
  stores: { tixora: string | null; wren: string | null };
  paypalReady: boolean;
  preset: string | null;
  origin: string;
}) {
  const start = preset === "ticket" || preset === "dress" ? preset : null;
  const linkFor = (kind: "ticket" | "dress") => {
    const link = kind === "ticket" ? stores.tixora : stores.wren;
    return link ? `${origin}${link}` : "";
  };
  const [url, setUrl] = useState(start ? linkFor(start) : "");
  const [wants, setWants] = useState(start ? PRESETS[start].wants : "");
  const [busy, setBusy] = useState<"draft" | "hold" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Editable checklist
  const [title, setTitle] = useState("");
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [maxTotal, setMaxTotal] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [days, setDays] = useState("14");
  const [anySeller, setAnySeller] = useState(false);

  function fill(kind: "ticket" | "dress") {
    setUrl(linkFor(kind));
    setWants(PRESETS[kind].wants);
    setDraft(null);
  }

  async function makeDraft() {
    setBusy("draft");
    setError(null);
    try {
      const res = await fetch("/api/watches/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, wants }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const d: Draft = json.draft;
      setItem(json.item);
      setDraft(d);
      setTitle(d.title);
      setMustHave(d.mustHave);
      setMaxTotal(d.maxTotalUsd ? String(d.maxTotalUsd) : "");
      setQuantity(String(d.quantity ?? 1));
      setDays(String(Math.min(29, Math.max(1, d.expiresInDays ?? 14))));
      setAnySeller(json.item.storeSeller ? d.anySeller : true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function startWatch() {
    setBusy("hold");
    setError(null);
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item!.url, wants, title, mustHave, maxTotalUsd: Number(maxTotal), quantity: Number(quantity), expiresInDays: Number(days), anySeller }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.approveUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader right={<Link href="/app" className="text-sm font-medium text-muted hover:text-ink">Cancel</Link>} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">New watch</h1>
        <p className="mt-1 text-muted">Point Scout at one exact page and say what you want in your own words.</p>

        <Card className="mt-6 p-5">
          <label className="block text-sm font-semibold" htmlFor="url">
            1. The page to watch
          </label>
          <input
            id="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setDraft(null);
            }}
            placeholder="Paste a product or event link"
            className="mt-2 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-ink"
          />
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="py-1 text-muted">Demo links:</span>
            <button onClick={() => fill("ticket")} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
              Tixora · concert tickets
            </button>
            <button onClick={() => fill("dress")} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
              Wren · wrap dress
            </button>
          </div>

          <label className="mt-6 block text-sm font-semibold" htmlFor="wants">
            2. What you want, exactly
          </label>
          <textarea
            id="wants"
            value={wants}
            onChange={(e) => {
              setWants(e.target.value);
              setDraft(null);
            }}
            rows={3}
            placeholder="e.g. One ticket, left wing only, under $40 including fees."
            className="mt-2 w-full resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-ink"
          />
          <p className="mt-1.5 text-xs text-muted">The more specific you are, the safer it is. Scout will only ever buy this one item.</p>

          {!draft && (
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={makeDraft} disabled={!url || !wants || busy !== null}>
                {busy === "draft" ? "Scout is reading the page…" : "Turn this into a checklist"}
              </Button>
              {busy === "draft" && <Character who="scout" mood="thinking" size={36} />}
            </div>
          )}
        </Card>

        {draft && item && (
          <Card className="rise mt-4 p-5">
            <div className="flex gap-3">
              <Character who="scout" mood="happy" size={48} className="shrink-0" />
              <div className="rounded-2xl rounded-tl-md bg-scout-soft px-3.5 py-2.5 text-[15px]">{draft.scoutLine}</div>
            </div>

            <div className="mt-5 text-sm font-semibold">3. Check the order</div>
            <div className="mt-3 rounded-xl bg-bg p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Locked to this item</div>
              <div className="mt-1 font-medium">{item.name}</div>
              <div className="text-muted">
                on {item.store}
                {item.storeSeller ? (anySeller ? " · any seller of this exact item" : ` · sold by ${item.storeSeller} only`) : " · any reseller on this event page"}
              </div>
              {item.storeSeller && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={anySeller} onChange={(e) => setAnySeller(e.target.checked)} />
                  Allow marketplace sellers too
                </label>
              )}
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="title">
              Name
            </label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink" />

            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">It must be</div>
            <ul className="mt-1 space-y-1.5">
              {mustHave.map((m, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-good text-[10px] font-bold text-white">✓</span>
                  <span className="flex-1">{m}</span>
                  <button aria-label="Remove" onClick={() => setMustHave(mustHave.filter((_, n) => n !== i))} className="text-muted hover:text-bad">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {draft.unclear.length > 0 && (
              <div className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Not sure about: {draft.unclear.join(" ")}</div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Field label="Most in total ($)" value={maxTotal} onChange={setMaxTotal} />
              <Field label="Quantity" value={quantity} onChange={setQuantity} />
              <Field label="Watch for (days)" value={days} onChange={setDays} />
            </div>

            <div className="mt-6 rounded-xl border border-line p-4 text-sm">
              <div className="flex gap-3">
                <Character who="vault" mood="calm" size={40} className="shrink-0" />
                <div>
                  <div className="font-semibold">PayPal holds up to ${maxTotal || "…"}. Nothing is taken yet.</div>
                  <p className="mt-1 text-muted">
                    Money only moves if Scout finds a match, the Banker agrees, and every Vault limit passes. If nothing matches, the hold is released. Holds last up to 29 days.
                  </p>
                </div>
              </div>
            </div>

            {!paypalReady && <p className="mt-3 text-sm text-bad">PayPal isn&apos;t connected on this server yet, so watches can&apos;t start.</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={startWatch} disabled={busy !== null || !paypalReady || !maxTotal || mustHave.length === 0} className="bg-[#0070e0] hover:bg-[#005ec2]">
                {busy === "hold" ? "Opening PayPal…" : "Approve the hold with PayPal"}
              </Button>
              <Button kind="ghost" onClick={() => setDraft(null)}>
                Start over
              </Button>
            </div>
          </Card>
        )}

        {error && <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      </main>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        className="tabular mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}
