"use client";

import { useEffect, useState } from "react";
import Character from "./Character";
import { AppHeader, Button, Card } from "./ui";
import BackLink from "./BackLink";
import type { Draft } from "@/lib/ai";
import type { Extracted } from "@/lib/extract";

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

// Real stores whose robots.txt lets automated agents read product pages (and keeps them out of checkout).
const REAL = [
  { label: "Allbirds · Tree Runner", url: "https://www.allbirds.com/products/mens-tree-runners" },
  { label: "Gymshark · Arrival shorts", url: "https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22" },
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
  const [wants, setWants] = useState("");
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

  const found = shownPreview?.data?.acceptsPayPal ? shownPreview.data : null;

  // Editable checklist
  const [title, setTitle] = useState("");
  const [mustHave, setMustHave] = useState<Check[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [maxTotal, setMaxTotal] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [days, setDays] = useState("14");
  const [anySeller, setAnySeller] = useState(false);
  const [mode, setMode] = useState<"ALERT" | "BUY">("ALERT");
  const [notBefore, setNotBefore] = useState<string | null>(null);
  const [today, setToday] = useState<{ totalCents: number; priceCents: number; feeCents: number; feesKnown: boolean } | null>(null);
  const [budgetSuggested, setBudgetSuggested] = useState(false);
  const [availableNow, setAvailableNow] = useState<{ name: string; priceCents: number; url: string }[]>([]);
  const [showAllOptions, setShowAllOptions] = useState(false);

  function changeLink(next: string) {
    setUrl(next);
    setWants("");
    setDraft(null);
  }


  async function makeDraft() {
    setBusy("draft");
    setError(null);
    try {
      const res = await fetch("/api/watches/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, wants, now: localNow(), tzOffset: new Date().getTimezoneOffset() }) });
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
      setNotBefore(json.notBefore ?? null);
      setToday(json.today ?? null);
      setBudgetSuggested(!!json.budgetSuggested);
      setAvailableNow(json.availableNow ?? []);
      setShowAllOptions(false);
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
      // Replace the form in history, so Back from the new watch goes where you came from (like the homepage).
      window.location.replace(json.approveUrl ?? `/app/w/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader right={<BackLink label="Cancel" />} />
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
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="py-1 text-muted">Demo links:</span>
            <button onClick={() => changeLink(linkFor("ticket"))} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
              Tixora · concert tickets
            </button>
            <button onClick={() => changeLink(linkFor("dress"))} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
              Wren · wrap dress
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="py-1 text-muted">Real stores:</span>
            {REAL.map((r) => (
              <button key={r.url} onClick={() => changeLink(r.url)} className="rounded-full border border-line px-2.5 py-1 hover:border-ink">
                {r.label}
              </button>
            ))}
          </div>
          {shownPreview && <PreviewCard p={shownPreview} />}
          {shownPreview?.data && !shownPreview.data.acceptsPayPal && (
            <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
              Standby only watches shopping pages that accept PayPal, and this page doesn&apos;t show PayPal as a way to pay. Try another store.
            </p>
          )}
          {found && <FoundPanel d={found} onSwitchLink={changeLink} />}

          {found && (
            <div className="rise mt-6">
              <label className="flex items-center gap-2 text-[15px] font-semibold" htmlFor="wants">
                <Character who="scout" mood="happy" size={30} className="shrink-0" />
                2. What would you like Scout to watch on this page?
              </label>
              <textarea
                id="wants"
                value={wants}
                onChange={(e) => {
                  setWants(e.target.value);
                  setDraft(null);
                }}
                rows={3}
                placeholder={found.kind === "TICKET" ? "e.g. One seat in the left wing under $40 including fees." : "e.g. Size 11 when it's back in stock, under $110."}
                className="mt-2 w-full resize-none rounded-xl border border-line px-3.5 py-2.5 text-[15px] outline-none focus:border-ink"
              />
              {found.suggestions.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-muted">Scout can watch for:</div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {found.suggestions.map((sg) => (
                      <button
                        key={sg.title}
                        type="button"
                        onClick={() => {
                          setWants(sg.sentence.replace("{time}", tomorrowAtNine()));
                          setDraft(null);
                        }}
                        className="rounded-full border border-scout/40 bg-scout-soft/60 px-3 py-1.5 text-sm hover:border-scout"
                      >
                        {sg.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!draft && (
                <div className="mt-5 flex items-center gap-3">
                  <Button onClick={makeDraft} disabled={!wants.trim() || busy !== null}>
                    {busy === "draft" ? "Scout is reading the page…" : "Turn this into a checklist"}
                  </Button>
                  {busy === "draft" && <Character who="scout" mood="thinking" size={36} />}
                </div>
              )}
            </div>
          )}
        </Card>

        {draft && item && availableNow.length > 0 && (
          <Card className="rise mt-4 p-5">
            <div className="flex gap-3">
              <Character who="scout" mood="happy" size={48} className="shrink-0" />
              <div className="space-y-2 text-[15px]">
                <div className="rounded-2xl rounded-tl-md bg-good-soft px-3.5 py-2.5">
                  <span className="font-semibold">Good news: you can get this right now.</span>{" "}
                  {availableNow.map((a) => `${a.name.startsWith(`${item.name} - `) ? a.name.slice(item.name.length + 3) : a.name} is in stock at ${usd(a.priceCents)}`).join("; ")}
                  {draft.maxTotalUsd ? `, inside your $${draft.maxTotalUsd} budget.` : "."}
                </div>
                <div className="rounded-2xl rounded-tl-md bg-scout-soft px-3.5 py-2.5">
                  There&apos;s nothing to wait for, so I won&apos;t start a watch. I&apos;m for what you can&apos;t get yet: a sold-out size, a lower price, a set time.
                  Change your words above if you&apos;re waiting for one of those.
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a href={availableNow[0].url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black">
                Buy it now on {item.store} ↗
              </a>
              <Button kind="ghost" onClick={() => setDraft(null)}>
                Change what I want
              </Button>
            </div>
          </Card>
        )}

        {draft && item && availableNow.length === 0 && (
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
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-semibold">3. The exact option{picked.length === 1 ? "" : "s"}</div>
                  <button type="button" onClick={() => setShowAllOptions(!showAllOptions)} className="text-xs font-semibold text-brand hover:underline">
                    {picked.length === 0 ? "" : showAllOptions ? "Done" : "Change"}
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-muted">The Vault will only ever accept what&apos;s ticked.</p>
                <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {item.choices.filter((c) => showAllOptions || picked.length === 0 || picked.includes(c.id)).map((c) => {
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
              <Field id="max-total" label="Most in total ($)" value={maxTotal} onChange={setMaxTotal} warn={!maxTotal} />
              <Field label="Quantity" value={quantity} onChange={setQuantity} />
              <Field label="Watch for (days)" value={days} onChange={setDays} />
            </div>
            {today && <BudgetNote today={today} suggested={budgetSuggested} maxTotal={maxTotal} isDemo={item.isDemo} />}

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
                    ? `Approve a PayPal hold now. Standby pays the moment every check passes, never more than ${maxTotal ? `$${maxTotal}` : "the most you set"}.`
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
                      {maxTotal ? (
                        <div className="font-semibold">PayPal holds up to ${maxTotal}. Nothing is taken yet.</div>
                      ) : (
                        <label className="flex flex-wrap items-center gap-2 font-semibold">
                          How much should PayPal hold, at most?
                          <span className="inline-flex items-center rounded-xl border-2 border-warn/60 bg-white px-2.5 py-1 font-normal focus-within:border-ink">
                            $
                            <input
                              value={maxTotal}
                              onChange={(e) => setMaxTotal(e.target.value.replace(/[^0-9.]/g, ""))}
                              inputMode="decimal"
                              size={6}
                              placeholder="70"
                              aria-label="Most you'll pay, in dollars"
                              className="tabular w-16 bg-transparent outline-none"
                            />
                          </span>
                        </label>
                      )}
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
                    <p className="mt-2 flex items-center gap-2 font-medium text-brand">
                      Scout stays quiet until {new Date(notBefore).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, then starts.
                      <button type="button" aria-label="Start now instead" onClick={() => setNotBefore(null)} className="text-muted hover:text-bad">
                        ✕
                      </button>
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
              {!maxTotal && (
                <button type="button" onClick={() => document.getElementById("max-total")?.focus()} className="text-sm font-medium text-warn underline-offset-2 hover:underline">
                  Scout couldn&apos;t tell your budget. Fill in &ldquo;Most in total&rdquo; to start.
                </button>
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

// Scout's sum of what it costs today, so the budget starts from a real number. You can lower it (wait for a
// better price) or raise it (prices that tend to climb: resale tickets, launches). The Vault never pays more.
function BudgetNote({
  today,
  suggested,
  maxTotal,
  isDemo,
}: {
  today: { totalCents: number; priceCents: number; feeCents: number; feesKnown: boolean };
  suggested: boolean;
  maxTotal: string;
  isDemo: boolean;
}) {
  const set = Number(maxTotal) * 100;
  const breakdown = today.feeCents ? ` (${usd(today.priceCents)} + ${usd(today.feeCents)} ${isDemo ? "shipping and fees" : "fees"})` : "";
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p className="text-muted">
        <span className="font-semibold text-ink">Today&apos;s total: {usd(today.totalCents)}</span>
        {breakdown}
        {!today.feesKnown && ". This page doesn't show shipping or tax, so add some room if you need it"}.
        {suggested && " Scout filled in your budget from this. Lower it to wait for a better price."}
      </p>
      {set > today.totalCents && (
        <p className="text-warn">
          That&apos;s {usd(set - today.totalCents)} more than today. Fine if the price may rise (resale tickets, launches); Standby still never pays more than {usd(set)}.
        </p>
      )}
    </div>
  );
}

function Field({ id, label, value, onChange, warn }: { id?: string; label: string; value: string; onChange: (v: string) => void; warn?: boolean }) {
  return (
    <label className="block">
      <span className={`block text-xs font-semibold uppercase tracking-wide ${warn ? "text-warn" : "text-muted"}`}>{label}</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        className={`tabular mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-ink ${warn ? "border-2 border-warn/60" : "border-line"}`}
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
  aiCheckout: { supported: boolean; checkout: boolean; payWith: string[]; paypal: boolean } | null;
  extracted: Extracted;
  suggestions: { title: string; sentence: string }[];
};

function localNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tomorrowAtNine() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(9, 0, 0, 0);
  return `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} on ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

// Everything Scout read on the page, from its own product data: colours, sizes with what's sold out, or the tickets on sale.
function FoundPanel({ d, onSwitchLink }: { d: Preview; onSwitchLink: (url: string) => void }) {
  const { groups, tickets } = d.extracted;
  if (!groups.length && !tickets.length) return null;
  return (
    <section className="rise mt-3 rounded-2xl border border-line bg-bg/60 p-4" aria-labelledby="found-title">
      <h2 id="found-title" className="text-sm font-semibold">
        What Scout found on this page
      </h2>
      <div className="mt-3 space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {g.chips.map((c) =>
                c.url ? (
                  <button
                    key={c.text}
                    type="button"
                    onClick={() => onSwitchLink(c.url!)}
                    title="This colour has its own page. Tap to open it."
                    className="rounded-lg border border-line bg-white px-2.5 py-1 text-sm hover:border-ink"
                  >
                    {c.text} <span className="text-muted" aria-hidden>↗</span>
                  </button>
                ) : (
                  <span
                    key={c.text}
                    className={`rounded-lg border px-2.5 py-1 text-sm ${c.here ? "border-ink bg-white font-semibold" : c.inStock ? "border-line bg-white" : "border-dashed border-line bg-transparent text-muted"}`}
                  >
                    <span className={c.inStock ? "" : "line-through decoration-1"}>{c.text}</span>
                    {!c.inStock && <span className="ml-1 text-[11px] font-semibold text-[#9a5d00]">sold out</span>}
                    {c.here && <span className="ml-1 text-[11px] font-normal text-muted">this page</span>}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
        {tickets.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Tickets on sale now ({tickets.length})</div>
            <ul className="mt-1.5 divide-y divide-line rounded-xl border border-line bg-white text-sm">
              {tickets.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {t.label}
                    <span className="block text-xs text-muted">Sold by {t.seller}</span>
                  </span>
                  <span className="tabular font-semibold">{dollars(t.priceCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

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
            <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad">✕ This shopping page doesn&apos;t accept PayPal</span>
          )}
        </div>
        {d.aiCheckout?.checkout && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-2 py-0.5 text-[11px] font-medium text-muted">
              Accepts AI checkouts
              {d.aiCheckout.payWith.length ? ` · pays with ${d.aiCheckout.payWith.join(", ")}` : ""}
              {d.aiCheckout.paypal ? "" : " (not PayPal)"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
