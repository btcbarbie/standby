"use client";

import { useEffect, useState } from "react";
import Character from "./Character";
import { AppHeader, Button, Card } from "./ui";
import BackLink from "./BackLink";
import type { Draft } from "@/lib/ai";
import type { Extracted, Lock } from "@/lib/extract";

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
  const [locks, setLocks] = useState<Lock[]>([]);
  const [availableNow, setAvailableNow] = useState<{ name: string; priceCents: number; url: string }[]>([]);

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
      // A PayPal hold lasts 29 days, counted from now, so a later start leaves fewer days to watch.
      const startsIn = json.notBefore ? daysFromNow(json.notBefore) : 0;
      setDays(String(Math.min(29 - startsIn, Math.max(1, d.expiresInDays ?? 14))));
      setAnySeller(json.item.storeSeller ? d.anySeller : true);
      setMode(json.item.acceptsAiBuyers ? "BUY" : "ALERT");
      setNotBefore(json.notBefore ?? null);
      setToday(json.today ?? null);
      setBudgetSuggested(!!json.budgetSuggested);
      setLocks(json.locks ?? []);
      setAvailableNow(json.availableNow ?? []);
      setDetails(false);
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
        body: JSON.stringify({ url: item!.url, wants, title, mustHave: mustHave.map((m) => m.text), optionIds: picked, locks, seller: item!.storeSeller, maxTotalUsd: Number(maxTotal), quantity: Number(quantity), expiresInDays: Number(days), anySeller, mode, notBefore }),
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

  const [details, setDetails] = useState(false);
  const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const canStart = busy === null && !!maxTotal && mustHave.length > 0 && (mode === "ALERT" || paypalReady);

  return (
    <div className="min-h-screen">
      <AppHeader right={<BackLink label="Cancel" />} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">New watch</h1>
        <p className="mt-1 text-muted">Three steps: the link, what you want, then check Scout&apos;s plan.</p>

        <Card className="mt-6 p-5">
          <StepLabel n={1} htmlFor="url">
            Paste the link
          </StepLabel>
          {/* A search-bar style address box, like the one on the homepage. */}
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
              placeholder="Paste a product or ticket link"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {url && (
              <button type="button" aria-label="Clear the link" onClick={() => changeLink("")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink">
                ✕
              </button>
            )}
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
              <StepLabel n={2} htmlFor="wants">
                What should Scout watch for?
              </StepLabel>
              <textarea
                id="wants"
                value={wants}
                onChange={(e) => {
                  setWants(e.target.value);
                  setDraft(null);
                }}
                rows={2}
                placeholder={found.kind === "TICKET" ? "e.g. One seat in the left wing under $40 including fees." : "e.g. Size 11 when it's back in stock."}
                className="mt-2 w-full resize-none rounded-xl border border-line px-3.5 py-2.5 text-[15px] outline-none focus:border-ink"
              />
              {found.suggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">Or pick:</span>
                  {found.suggestions.map((sg) => (
                    <button
                      key={sg.title}
                      type="button"
                      onClick={() => {
                        setWants(sg.sentence.replace("{time}", tomorrowAtNine()));
                        setDraft(null);
                      }}
                      className="rounded-full border border-scout/40 bg-scout-soft/60 px-2.5 py-1 text-xs hover:border-scout"
                    >
                      {sg.title}
                    </button>
                  ))}
                </div>
              )}

              {!draft && (
                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={makeDraft} disabled={!wants.trim() || busy !== null}>
                    {busy === "draft" ? "Scout is making a plan…" : "Make the plan"}
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
            <StepLabel n={3}>Check Scout&apos;s plan</StepLabel>

            {/* The plan in one sentence. The parts in boxes can be changed right here. */}
            <div className="mt-3 flex gap-3">
              <Character who="scout" mood="happy" size={44} className="shrink-0" />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-scout-soft px-4 py-3.5 text-[15px] leading-8">
                <span className="text-muted">I&apos;ll watch</span> <strong>{item.name}</strong> <span className="text-muted">on {item.store}</span>{" "}
                <span className="text-muted">for</span> <strong>{title}</strong>
                {notBefore && (
                  <>
                    , <span className="text-muted">starting</span>{" "}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 font-semibold ring-1 ring-line">
                      {fmtWhen(notBefore)}
                      <button type="button" aria-label="Start now instead" title="Start now instead" onClick={() => setNotBefore(null)} className="text-muted hover:text-bad">
                        ✕
                      </button>
                    </span>
                  </>
                )}
                . <span className="text-muted">Most in total:</span>{" "}
                <InlineNumber id="max-total" prefix="$" value={maxTotal} onChange={setMaxTotal} warn={!maxTotal} label="Most you'll pay in total, in dollars" />
                , <span className="text-muted">for</span> <InlineNumber value={days} onChange={setDays} label="How many days to watch" /> <span className="text-muted">days. Then</span>{" "}
                {item.acceptsAiBuyers ? (
                  <span className="inline-flex rounded-lg bg-white p-0.5 align-middle text-sm ring-1 ring-line" role="radiogroup" aria-label="When it matches">
                    {(["ALERT", "BUY"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => setMode(m)}
                        className={`rounded-md px-2.5 py-0.5 font-semibold transition ${mode === m ? (m === "BUY" ? "bg-[#0070e0] text-white" : "bg-ink text-white") : "text-muted hover:text-ink"}`}
                      >
                        {m === "ALERT" ? "tell you" : "buy it for you"}
                      </button>
                    ))}
                  </span>
                ) : (
                  <strong>tell you, and you buy it on the store&apos;s own checkout</strong>
                )}
                .
              </div>
            </div>

            {/* The checks behind the plan, in one line, so a misread is easy to spot. */}
            <p className="mt-3 text-sm text-muted">
              <span className="font-semibold text-ink">It must be:</span> {mustHave.map((m) => m.text).join(" · ")}
              {locks.length > 0 && <> · only {locks.map((l) => `${l.field} ${l.values.length > 4 ? `${l.values[0]}–${l.values[l.values.length - 1]}` : l.values.join("/")}`).join(", ")}</>}
            </p>
            {draft.cantSee.map((c, i) => (
              <p key={i} className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
                {c}
              </p>
            ))}
            {today && <BudgetNote today={today} suggested={budgetSuggested} maxTotal={maxTotal} isDemo={item.isDemo} />}
            {mode === "BUY" && (
              <p className="mt-2 text-sm text-muted">
                You&apos;ll approve a PayPal hold of up to {maxTotal ? `$${maxTotal}` : "your limit"}. Nothing is taken unless Scout, the Banker and the Vault all agree; otherwise the hold is released.
              </p>
            )}
            {mode === "BUY" && !paypalReady && <p className="mt-2 text-sm text-bad">PayPal isn&apos;t connected on this server yet, so Buy it for me can&apos;t start.</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={startWatch} disabled={!canStart} kind={mode === "BUY" ? "paypal" : "primary"}>
                {busy === "hold" ? (mode === "BUY" ? "Opening PayPal…" : "Starting…") : mode === "BUY" ? "Approve the hold with PayPal" : "Start watching"}
              </Button>
              <button type="button" onClick={() => setDetails(!details)} aria-expanded={details} className="text-sm font-semibold text-brand hover:underline">
                {details ? "Hide details" : "Edit details"}
              </button>
              <Button kind="ghost" onClick={() => setDraft(null)}>
                Start over
              </Button>
            </div>
            {!maxTotal && <p className="mt-2 text-sm text-warn">Scout couldn&apos;t tell your budget. Fill in &ldquo;Most in total&rdquo; above to start.</p>}

            {details && (
              <div className="rise mt-5 space-y-5 border-t border-line pt-5">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Name</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink" />
                </label>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">It must be</div>
                  <ul className="mt-1 space-y-1.5">
                    {mustHave.map((m, i) => (
                      <li key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${m.source === "NOT_ON_PAGE" ? "border-warn/40 bg-warn-soft/40" : "border-line"}`}>
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${SOURCE[m.source].cls}`} title={SOURCE[m.source].label}>
                          {SOURCE[m.source].icon}
                        </span>
                        <span className="flex-1">
                          {m.text}
                          <span className={`block text-xs ${m.source === "NOT_ON_PAGE" ? "text-warn" : "text-muted"}`}>{SOURCE[m.source].label}</span>
                        </span>
                        <button aria-label="Remove" onClick={() => setMustHave(mustHave.filter((_, n) => n !== i))} className="text-muted hover:text-bad">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {locks.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">Only listings with</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {locks.map((l) => (
                        <span key={l.field} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-sm">
                          <span className="font-semibold capitalize">{l.field}</span>
                          <span className="text-muted">{l.values.join(", ")}</span>
                          <button type="button" aria-label={`Remove the ${l.field} limit`} onClick={() => setLocks(locks.filter((x) => x.field !== l.field))} className="text-muted hover:text-bad">
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">Read from each listing&apos;s own details. Scout skips anything else, and the Vault checks again before paying.</p>
                  </div>
                )}

                {item.pickable && item.choices.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">The exact options</div>
                    <p className="text-xs text-muted">The Vault will only ever accept what&apos;s ticked. Sold-out ones are fine: Scout waits for a restock.</p>
                    <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
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
                              <span className="min-w-0 flex-1 truncate">{c.name.startsWith(`${item.name} - `) ? c.name.slice(item.name.length + 3) : c.name}</span>
                              <span className="tabular shrink-0 text-muted">{usd(c.priceCents)}</span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${c.inStock ? "bg-good-soft text-good" : "bg-vault-soft text-vault"}`}>{c.inStock ? "In stock" : "Sold out"}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-4">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Quantity</span>
                    <input
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      className="tabular mt-1 w-20 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink"
                    />
                  </label>
                  {item.storeSeller && (
                    <label className="flex items-center gap-2 pb-2 text-sm text-muted">
                      <input type="checkbox" checked={anySeller} onChange={(e) => setAnySeller(e.target.checked)} />
                      Allow sellers other than {item.storeSeller}
                    </label>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {error && <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      </main>
    </div>
  );
}

function StepLabel({ n, htmlFor, children }: { n: number; htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-2 text-[15px] font-semibold">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-xs font-bold text-white" aria-hidden>
        {n}
      </span>
      {children}
    </label>
  );
}

// A small number box that sits inside the plan's sentence.
function InlineNumber({ id, value, onChange, prefix, warn, label }: { id?: string; value: string; onChange: (v: string) => void; prefix?: string; warn?: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-lg bg-white px-2 py-0.5 align-middle font-semibold ring-1 ${warn ? "ring-2 ring-warn/70" : "ring-line"} focus-within:ring-2 focus-within:ring-ink`}>
      {prefix}
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        aria-label={label}
        size={Math.max(2, value.length + 1)}
        placeholder="?"
        className="tabular bg-transparent text-center outline-none"
      />
    </span>
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

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

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
  const [all, setAll] = useState(false);
  if (!groups.length && !tickets.length) return null;
  const hidden = groups.reduce((n, g) => n + Math.max(0, g.chips.length - 10), 0) + Math.max(0, tickets.length - 4);
  return (
    <section className="rise mt-3 rounded-2xl border border-line bg-bg/60 p-3.5" aria-labelledby="found-title">
      <h2 id="found-title" className="text-sm font-semibold">
        What Scout found on this page
      </h2>
      <div className="mt-2.5 space-y-2.5">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(all ? g.chips : g.chips.slice(0, 10)).map((c) =>
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
              {(all ? tickets : tickets.slice(0, 4)).map((t, i) => (
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
        {hidden > 0 && (
          <button type="button" onClick={() => setAll(!all)} className="text-xs font-semibold text-brand hover:underline">
            {all ? "Show less" : `+${hidden} more`}
          </button>
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
