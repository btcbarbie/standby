"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Character from "./Character";
import { AppHeader, Button, Card } from "./ui";
import type { Draft } from "@/lib/ai";
import WatchPlanner, { type Choice, type Plan, type Sibling } from "./WatchPlanner";

type Item = {
  url: string;
  listingId: string;
  name: string;
  kind: string;
  store: string;
  storeSeller: string | null;
  isDemo: boolean;
  acceptsAiBuyers: boolean;
  options: number;
  inStock: number;
  pickable: boolean;
  choices: { id: string; name: string; priceCents: number; inStock: boolean; seller: string }[];
  priceRange: [number, number] | null;
};

type Check = Draft["mustHave"][number];

const SOURCE: Record<Check["source"], { label: string; cls: string; icon: string }> = {
  PRODUCT_DATA: { label: "Checked in the store's product data", cls: "bg-good text-white", icon: "✓" },
  PAGE_TEXT: { label: "Read from the page's words", cls: "bg-brand text-white", icon: "✓" },
  NOT_ON_PAGE: { label: "Not on this page, so it can't be checked", cls: "bg-warn text-white", icon: "!" },
};

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

const PRESETS = {
  ticket: { wants: "One ticket for the Nova Adé show, left wing only, under $40 including fees. Just one ticket, never more." },
  dress: { wants: "The Ada wrap dress in green, size 8. Only from Wren itself, and no more than $70 with shipping." },
};

// Real stores whose robots.txt lets automated agents read product pages (and keeps them out of checkout).
const REAL = [
  {
    label: "Allbirds · Tree Runner",
    url: "https://www.allbirds.com/products/mens-tree-runners",
    wants: "Men's Tree Runner in Jet Black with the white sole, size 8. Under $110. Just one pair.",
  },
  {
    label: "Gymshark · Arrival shorts",
    url: "https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22",
    wants: "Arrival 5 inch shorts in black, size M. Under $30. One pair.",
  },
];

export default function NewWatch({
  stores,
  paypalReady,
  preset,
  origin,
  pastedUrl,
}: {
  stores: { tixora: string | null; wren: string | null };
  paypalReady: boolean;
  preset: string | null;
  origin: string;
  pastedUrl?: string | null;
}) {
  const start = preset === "ticket" || preset === "dress" ? preset : null;
  const startReal = preset === "real" ? REAL[0] : null;
  const linkFor = (kind: "ticket" | "dress") => {
    const link = kind === "ticket" ? stores.tixora : stores.wren;
    return link ? `${origin}${link}` : "";
  };
  const [url, setUrl] = useState(start ? linkFor(start) : (startReal?.url ?? pastedUrl ?? ""));
  const [wants, setWants] = useState(start ? PRESETS[start].wants : (startReal?.wants ?? ""));
  const [busy, setBusy] = useState<"draft" | "hold" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // A quick look at the pasted link (no AI), shown as a preview card. Keyed by the link it belongs to,
  // so an older answer never shows for a newer link.
  const [preview, setPreview] = useState<{ forUrl: string; loading: boolean; data?: Preview; error?: string } | null>(null);
  useEffect(() => {
    const link = url.trim();
    if (link.length < 8) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreview({ forUrl: link, loading: true });
      try {
        const res = await fetch("/api/watches/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }) });
        const json = await res.json();
        if (!cancelled) setPreview(res.ok ? { forUrl: link, loading: false, data: json } : { forUrl: link, loading: false, error: json.error ?? "Couldn't read that page." });
      } catch {
        if (!cancelled) setPreview({ forUrl: link, loading: false, error: "Couldn't reach Standby. Try again." });
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [url]);
  const shownPreview = preview && preview.forUrl === url.trim() ? preview : null;

  // Your taps on the options Scout found. The sentence they write fills the box below, unless you've typed your own.
  const [picks, setPicks] = useState<{ forUrl: string; ids: string[]; notBefore: string | null } | null>(null);
  const [lastAuto, setLastAuto] = useState("");
  const pickedIds = picks && picks.forUrl === url.trim() ? picks.ids : [];
  const notBefore = picks && picks.forUrl === url.trim() ? picks.notBefore : null;
  function onPlan(plan: Plan) {
    setPicks({ forUrl: url.trim(), ids: plan.ids, notBefore: plan.notBefore });
    setDraft(null);
    if (wants.trim() === "" || wants === lastAuto) {
      setWants(plan.sentence);
      setLastAuto(plan.sentence);
    }
  }
  const choices = shownPreview?.data?.pickable ? (shownPreview.data.choices ?? []) : [];

  // Editable checklist
  const [title, setTitle] = useState("");
  const [mustHave, setMustHave] = useState<Check[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [maxTotal, setMaxTotal] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [days, setDays] = useState("14");
  const [anySeller, setAnySeller] = useState(false);
  const [mode, setMode] = useState<"ALERT" | "BUY">("ALERT");

  function fill(kind: "ticket" | "dress") {
    setUrl(linkFor(kind));
    setWants(PRESETS[kind].wants);
    setLastAuto(PRESETS[kind].wants);
    setDraft(null);
  }

  function fillReal(r: (typeof REAL)[number]) {
    setUrl(r.url);
    setWants(r.wants);
    setLastAuto(r.wants);
    setDraft(null);
  }

  async function makeDraft() {
    setBusy("draft");
    setError(null);
    try {
      const res = await fetch("/api/watches/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, wants, optionIds: pickedIds }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const d: Draft = json.draft;
      setItem(json.item);
      setDraft(d);
      setTitle(d.title);
      setMustHave(d.mustHave);
      setPicked(json.item.pickable ? d.matchingOptionIds.filter((id: string) => json.item.choices.some((c: { id: string }) => c.id === id)) : []);
      setMaxTotal(d.maxTotalUsd ? String(d.maxTotalUsd) : "");
      setQuantity(String(d.quantity ?? 1));
      setDays(String(Math.min(29, Math.max(1, d.expiresInDays ?? 14))));
      setAnySeller(json.item.storeSeller ? d.anySeller : true);
      setMode(json.item.acceptsAiBuyers ? "BUY" : "ALERT");
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
        body: JSON.stringify({ url: item!.url, wants, title, mustHave: mustHave.map((m) => m.text), optionIds: picked, maxTotalUsd: Number(maxTotal), quantity: Number(quantity), expiresInDays: Number(days), anySeller, mode, notBefore }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.approveUrl ?? `/app/w/${json.id}`;
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
          {/* A search-bar style address box, like Scout's browser on the homepage. */}
          <div className="group mt-2 flex items-center gap-2 rounded-full border-2 border-line bg-white py-1.5 pl-4 pr-1.5 transition focus-within:border-scout focus-within:shadow-[0_0_0_4px_rgba(232,147,12,0.15)]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted group-focus-within:text-scout" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              id="url"
              type="search"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setDraft(null);
              }}
              placeholder="Paste a product link"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {url && (
              <button type="button" aria-label="Clear the link" onClick={() => { setUrl(""); setDraft(null); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink">
                ✕
              </button>
            )}
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-scout-soft px-3 py-1.5 text-xs font-bold text-[#9a5d00] sm:inline-flex">
              <Character who="scout" mood="happy" size={18} /> Scout
            </span>
          </div>
          {shownPreview && <PreviewCard p={shownPreview} />}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="py-1 text-muted">Demo links:</span>
            <button onClick={() => fill("ticket")} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
              Tixora · concert tickets
            </button>
            <button onClick={() => fill("dress")} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
              Wren · wrap dress
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="py-1 text-muted">Real stores:</span>
            {REAL.map((r) => (
              <button key={r.url} onClick={() => fillReal(r)} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-6 text-sm font-semibold">2. What you want, exactly</div>
          {shownPreview?.data && shownPreview.data.acceptsPayPal && (
            <WatchPlanner
              key={shownPreview.data.url}
              productName={shownPreview.data.name}
              canBuy={shownPreview.data.isDemo}
              priceCents={shownPreview.data.priceRange ? shownPreview.data.priceRange[0] : null}
              choices={choices}
              siblings={shownPreview.data.siblings ?? []}
              onChange={onPlan}
              onSwitchLink={(next) => {
                setUrl(next);
                setDraft(null);
                setWants("");
                setLastAuto("");
              }}
            />
          )}
          <label className={`block text-sm ${shownPreview?.data ? "mt-3 font-medium text-muted" : "sr-only"}`} htmlFor="wants">
            {shownPreview?.data ? "Scout writes it as you choose. Edit it, or describe it in your own words:" : "What you want, exactly"}
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
              <div className="space-y-2">
                <div className="rounded-2xl rounded-tl-md bg-scout-soft px-3.5 py-2.5 text-[15px]">{draft.pageSummary}</div>
                {draft.cantSee.map((c, i) => (
                  <div key={i} className="rounded-2xl rounded-tl-md bg-warn-soft px-3.5 py-2.5 text-[15px] text-warn">
                    {c}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-bg px-2.5 py-1">
                <span className="font-semibold">{item.options}</span> option{item.options === 1 ? "" : "s"} listed
              </span>
              <span className="rounded-full bg-bg px-2.5 py-1">
                <span className="font-semibold">{item.inStock}</span> in stock now
              </span>
              {item.priceRange && (
                <span className="rounded-full bg-bg px-2.5 py-1">
                  {item.priceRange[0] === item.priceRange[1] ? usd(item.priceRange[0]) : `${usd(item.priceRange[0])}–${usd(item.priceRange[1])}`}
                </span>
              )}
              <span className="rounded-full bg-bg px-2.5 py-1">{item.store}</span>
            </div>

            {item.pickable && item.choices.length > 0 && (
              <div className="mt-5">
                <div className="text-sm font-semibold">3. Tap what you want</div>
                <p className="mt-0.5 text-xs text-muted">
                  Scout ticked what matches your words. Change it if needed. Sold-out options are fine: Scout waits for a restock. The Vault will only ever accept what&apos;s ticked.
                </p>
                <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {item.choices.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(on ? picked.filter((p) => p !== c.id) : [...picked, c.id])}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${on ? "border-ink bg-bg ring-1 ring-ink" : "border-line hover:border-ink"}`}
                        >
                          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold ${on ? "border-ink bg-ink text-white" : "border-line"}`}>{on ? "✓" : ""}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{c.name.startsWith(`${item.name} - `) ? c.name.slice(item.name.length + 3) : c.name}</span>
                            {c.seller && c.seller !== item.store && c.seller !== item.storeSeller && item.isDemo && <span className="block text-xs text-muted">Sold by {c.seller}</span>}
                          </span>
                          <span className="tabular shrink-0 text-muted">{usd(c.priceCents)}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${c.inStock ? "bg-good-soft text-good" : "bg-vault-soft text-vault"}`}>
                            {c.inStock ? "In stock" : "Sold out"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {picked.length === 0 && <p className="mt-2 text-xs text-warn">Nothing ticked: any option can match, and only the AIs judge which. Ticking makes it exact.</p>}
              </div>
            )}
            {!item.pickable && (
              <p className="mt-4 rounded-xl bg-bg px-3 py-2 text-xs text-muted">
                Ticket listings come and go, so there&apos;s nothing to tick. Scout, the Banker and the Vault check every new listing against your words.
              </p>
            )}

            <div className="mt-6 text-sm font-semibold">{item.pickable ? "4." : "3."} Check the order</div>
            <div className="mt-3 rounded-xl bg-bg p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Locked to this item</div>
              <div className="mt-1 font-medium">{item.name}</div>
              <div className="text-muted">
                on {item.store}
                {!item.isDemo
                  ? ` · ${item.options} option${item.options === 1 ? "" : "s"} on the page, ${item.inStock} in stock right now`
                  : item.storeSeller
                    ? anySeller
                      ? " · any seller of this exact item"
                      : ` · sold by ${item.storeSeller} only`
                    : " · any reseller on this event page"}
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
                <li key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${m.source === "NOT_ON_PAGE" ? "border-warn/40 bg-warn-soft/40" : "border-line"}`}>
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${SOURCE[m.source].cls}`} title={SOURCE[m.source].label}>
                    {SOURCE[m.source].icon}
                  </span>
                  <span className="flex-1">
                    {m.text}
                    <span className={`block text-xs ${m.source === "NOT_ON_PAGE" ? "text-warn" : "text-muted"}`}>
                      {SOURCE[m.source].label}
                      {m.source === "NOT_ON_PAGE" && ". Keep it and the checks will ask you, or remove it."}
                    </span>
                  </span>
                  <button aria-label="Remove" onClick={() => setMustHave(mustHave.filter((_, n) => n !== i))} className="text-muted hover:text-bad">
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Field label="Most in total ($)" value={maxTotal} onChange={setMaxTotal} />
              <Field label="Quantity" value={quantity} onChange={setQuantity} />
              <Field label="Watch for (days)" value={days} onChange={setDays} />
            </div>

            <div className="mt-6 text-sm font-semibold">{item.pickable ? "5." : "4."} When it matches</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <ModeCard
                selected={mode === "ALERT"}
                onSelect={() => setMode("ALERT")}
                title="Alert me, I'll pay"
                body={item.isDemo ? "Standby tells you. You approve the payment in PayPal yourself." : "Standby tells you. You buy it on the store's own checkout."}
              />
              <ModeCard
                selected={mode === "BUY"}
                onSelect={() => item.acceptsAiBuyers && setMode("BUY")}
                disabled={!item.acceptsAiBuyers}
                title="Buy it for me"
                body={
                  item.acceptsAiBuyers
                    ? `Approve a PayPal hold now. Standby pays the moment every check passes, never more than $${maxTotal || "…"}.`
                    : "Not available here: this store doesn't accept AI buyers yet. Stores opt in through programmes like PayPal's Agent Ready."
                }
              />
            </div>

            <div className="mt-4 rounded-xl border border-line p-4 text-sm">
              <div className="flex gap-3">
                <Character who="vault" mood="calm" size={40} className="shrink-0" />
                <div>
                  {mode === "BUY" ? (
                    <>
                      <div className="font-semibold">PayPal holds up to ${maxTotal || "…"}. Nothing is taken yet.</div>
                      <p className="mt-1 text-muted">
                        Money only moves if Scout finds a match, the Banker agrees, and every Vault limit passes. If nothing matches, the hold is released. Holds last up to 29
                        days.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">Nothing is held, and nothing is paid by Standby.</div>
                      <p className="mt-1 text-muted">
                        {item.isDemo
                          ? "When Scout, the Banker and the Vault all agree, you get a find to approve in PayPal."
                          : "Scout visits this one page every 5 minutes, says who it is, and never touches the store's checkout. When all three checks agree, you get a find and a link to buy it."}
                      </p>
                    </>
                  )}
                  {notBefore && (
                    <p className="mt-2 font-medium text-brand">
                      Scout stays quiet until {new Date(notBefore).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, then starts.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {mode === "BUY" && !paypalReady && <p className="mt-3 text-sm text-bad">PayPal isn&apos;t connected on this server yet, so Buy it for me can&apos;t start. Alert me works without it.</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {mode === "BUY" ? (
                <Button onClick={startWatch} disabled={busy !== null || !paypalReady || !maxTotal || mustHave.length === 0} className="bg-[#0070e0] hover:bg-[#005ec2]">
                  {busy === "hold" ? "Opening PayPal…" : "Approve the hold with PayPal"}
                </Button>
              ) : (
                <Button onClick={startWatch} disabled={busy !== null || !maxTotal || mustHave.length === 0}>
                  {busy === "hold" ? "Starting…" : "Start watching"}
                </Button>
              )}
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

function ModeCard({ selected, onSelect, title, body, disabled }: { selected: boolean; onSelect: () => void; title: string; body: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`rounded-xl border p-3 text-left transition ${selected ? "border-ink bg-bg ring-1 ring-ink" : "border-line hover:border-ink"} disabled:cursor-not-allowed disabled:opacity-55`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`grid h-4 w-4 place-items-center rounded-full border ${selected ? "border-ink bg-ink" : "border-line"}`}>
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        {title}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-muted">{body}</span>
    </button>
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

type Preview = {
  url: string;
  name: string;
  store: string;
  isDemo: boolean;
  kind: string;
  image: string | null;
  options: number;
  inStock: number;
  priceRange: [number, number] | null;
  acceptsPayPal: boolean;
  pickable?: boolean;
  choices?: Choice[];
  siblings?: Sibling[];
};

const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

// What Scout sees at the link, before any AI: photo, name, store, price, stock, and whether it takes PayPal.
function PreviewCard({ p }: { p: { loading: boolean; data?: Preview; error?: string } }) {
  if (p.loading) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-bg p-3" role="status">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-white motion-reduce:animate-none" />
        <div className="flex items-center gap-2 text-sm text-muted">
          <Character who="scout" mood="thinking" size={22} /> Scout is taking a quick look at the page…
        </div>
      </div>
    );
  }
  if (p.error || !p.data) {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-bad/25 bg-bad-soft/60 p-3 text-sm text-bad" role="alert">
        <Character who="scout" mood="stern" size={28} className="shrink-0" />
        <span>{p.error}</span>
      </div>
    );
  }
  const d = p.data;
  const price = d.priceRange ? (d.priceRange[0] === d.priceRange[1] ? dollars(d.priceRange[0]) : `${dollars(d.priceRange[0])}–${dollars(d.priceRange[1])}`) : null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-sm">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
        {d.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image} alt="" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-2xl" aria-hidden>
            {d.kind === "TICKET" ? "🎟️" : "🛍️"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{d.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {d.store}
          {d.isDemo ? " · demo store" : ""}
          {price ? ` · ${price}` : ""} · {d.inStock} of {d.options} option{d.options === 1 ? "" : "s"} in stock
        </div>
        <div className="mt-1.5">
          {d.acceptsPayPal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">✓ Accepts PayPal</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad">✕ No PayPal, so Standby can&apos;t watch it</span>
          )}
        </div>
      </div>
    </div>
  );
}
