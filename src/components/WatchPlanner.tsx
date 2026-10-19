"use client";

import { useState } from "react";
import Character from "./Character";

// Step 2 of a new watch. It leads with what the store can't give you right now, because that's why you'd use Standby
// instead of the store's own Buy button: something sold out, a lower price, another colour, or a set time (a drop).
// What's in stock today sits underneath: you could just buy those on the site.

export type Choice = { id: string; label: string; priceCents: number; inStock: boolean; seller: string };
export type Sibling = { url: string; label: string };
export type Plan = { ids: string[]; sentence: string; notBefore: string | null };

const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

// "Mushroom (Mushroom Sole) - Size 11" → "Size 11" when every option shares the same first part.
function shortLabels(choices: Choice[]) {
  const first = (l: string) => l.split(/\s+-\s+|\s+\/\s+/)[0];
  const same = choices.length > 1 && choices.every((c) => first(c.label) === first(choices[0].label)) && choices.some((c) => c.label !== first(c.label));
  return new Map(choices.map((c) => [c.id, same ? c.label.slice(first(c.label).length).replace(/^\s*[-/]\s*/, "") : c.label]));
}

function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WatchPlanner({
  productName,
  canBuy,
  priceCents,
  choices,
  siblings,
  onChange,
  onSwitchLink,
}: {
  productName: string;
  // Demo stores accept AI buyers. Real stores today: Scout tells you and you buy on the store's own checkout.
  canBuy: boolean;
  priceCents: number | null;
  choices: Choice[];
  siblings: Sibling[];
  onChange: (plan: Plan) => void;
  onSwitchLink: (url: string) => void;
}) {
  const labels = shortLabels(choices);
  const soldOut = choices.filter((c) => !c.inStock);
  const available = choices.filter((c) => c.inStock);

  const [ids, setIds] = useState<string[]>([]);
  const [priceOn, setPriceOn] = useState(false);
  const [target, setTarget] = useState(priceCents ? String(Math.floor((priceCents * 0.85) / 100)) : "");
  const [timeOn, setTimeOn] = useState(false);
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(9, 0, 0, 0);
    return localInputValue(d);
  });
  const [showAvailable, setShowAvailable] = useState(soldOut.length === 0);

  function publish(next: { ids?: string[]; priceOn?: boolean; target?: string; timeOn?: boolean; when?: string }) {
    const s = { ids, priceOn, target, timeOn, when, ...next };
    const picked = choices.filter((c) => s.ids.includes(c.id));
    const items = picked.length ? picked.map((c) => labels.get(c.id)).join(" or ") : choices.length ? "any option" : "it";
    const what = `${productName}${picked.length ? `, ${items}` : ""}`;
    const t = Number(s.target);
    const priceText = s.priceOn && t > 0 ? `when the price is $${t} or less` : "";
    const whenDate = s.timeOn && s.when ? new Date(s.when) : null;
    const timeText = whenDate ? `${whenDate.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
    const restock = picked.length > 0 && picked.every((c) => !c.inStock);
    let sentence = "";
    if (picked.length || priceText || timeText) {
      const onlyTime = !restock && !priceText && timeText;
      const lead = canBuy
        ? restock ? `Catch the restock of ${what} and buy it right away` : onlyTime ? `Buy ${what} the moment it goes on sale` : `Buy ${what}`
        : restock ? `Tell me the moment ${what} is back in stock` : onlyTime ? `Tell me the moment ${what} goes on sale` : `Tell me when I can get ${what}`;
      const conditions = priceText;
      const most = s.priceOn && t > 0 ? t : picked.length ? Math.max(...picked.map((c) => c.priceCents)) / 100 : priceCents ? priceCents / 100 : null;
      sentence = `${lead}${conditions ? ` ${conditions}` : ""}.${most ? ` Most I'll pay: $${most % 1 ? most.toFixed(2) : most}.` : ""}${timeText ? ` Don't start before ${timeText}.` : ""}${canBuy ? " Just one." : ""}`;
    }
    onChange({ ids: s.ids, sentence, notBefore: whenDate ? whenDate.toISOString() : null });
  }

  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    publish({ ids: next });
  }

  const chip = (on: boolean, dashed = false) =>
    `rounded-xl border px-3 py-1.5 text-sm transition ${on ? "border-ink bg-ink text-white" : dashed ? "border-dashed border-ink/40 bg-white hover:border-ink" : "border-line bg-white hover:border-ink"}`;

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-2">
        <Character who="scout" mood="happy" size={32} className="shrink-0" />
        <p className="text-sm">
          <span className="font-semibold">What the store can&apos;t give you right now.</span>{" "}
          <span className="text-muted">Pick what Scout should catch for you.</span>
        </p>
      </div>

      {soldOut.length > 0 && (
        <section className="rounded-2xl border-2 border-scout/40 bg-scout-soft/50 p-4" aria-labelledby="plan-soldout">
          <h3 id="plan-soldout" className="font-semibold">
            Sold out right now <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#9a5d00]">{soldOut.length}</span>
          </h3>
          <p className="mt-0.5 text-sm text-muted">Scout watches and {canBuy ? "buys" : "tells you"} the moment it&apos;s back. You&apos;d have to keep refreshing for this.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {soldOut.map((c) => (
              <button key={c.id} type="button" aria-pressed={ids.includes(c.id)} onClick={() => toggle(c.id)} className={chip(ids.includes(c.id), true)}>
                {labels.get(c.id)}
              </button>
            ))}
          </div>
        </section>
      )}

      {priceCents != null && (
        <section className={`rounded-2xl border-2 p-4 ${priceOn ? "border-good/40 bg-good-soft/40" : "border-line bg-white"}`} aria-labelledby="plan-price">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={priceOn}
              onChange={(e) => {
                setPriceOn(e.target.checked);
                publish({ priceOn: e.target.checked });
              }}
              className="mt-1 h-4 w-4 accent-[#067647]"
            />
            <span>
              <span id="plan-price" className="block font-semibold">
                Wait for a lower price
              </span>
              <span className="block text-sm text-muted">It&apos;s {dollars(priceCents)} today. Scout {canBuy ? "buys" : "tells you"} only when it drops to your price.</span>
            </span>
          </label>
          {priceOn && (
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-7 text-sm">
              <span className="whitespace-nowrap">Your price</span>
              <span className="inline-flex shrink-0 items-center rounded-xl border border-line bg-white px-2.5 py-1.5 focus-within:border-ink">
                $
                <input
                  value={target}
                  inputMode="decimal"
                  aria-label="Target price in dollars"
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setTarget(v);
                    publish({ target: v });
                  }}
                  size={5}
                  className="tabular w-14 bg-transparent outline-none"
                />
              </span>
              <span className="whitespace-nowrap text-muted">or less</span>
            </div>
          )}
        </section>
      )}

      {siblings.length > 0 && (
        <section className="rounded-2xl border-2 border-line bg-white p-4" aria-labelledby="plan-colours">
          <h3 id="plan-colours" className="font-semibold">
            Other colours
          </h3>
          <p className="mt-0.5 text-sm text-muted">This link is one colour. The store also lists these, each on its own page. Tap one to watch that instead.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {siblings.map((s) => (
              <button key={s.url} type="button" onClick={() => onSwitchLink(s.url)} className={chip(false)}>
                {s.label} <span aria-hidden>→</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={`rounded-2xl border-2 p-4 ${timeOn ? "border-brand/40 bg-brand-soft/40" : "border-line bg-white"}`} aria-labelledby="plan-time">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={timeOn}
            onChange={(e) => {
              setTimeOn(e.target.checked);
              publish({ timeOn: e.target.checked });
            }}
            className="mt-1 h-4 w-4 accent-[#1f4fd8]"
          />
          <span>
            <span id="plan-time" className="block font-semibold">
              At a set time
            </span>
            <span className="block text-sm text-muted">For a drop or a launch. Scout stays quiet until then, then checks {canBuy ? "and buys " : ""}in the first seconds.</span>
          </span>
        </label>
        {timeOn && (
          <div className="mt-3 pl-7">
            <input
              type="datetime-local"
              value={when}
              aria-label="Start time"
              onChange={(e) => {
                setWhen(e.target.value);
                publish({ when: e.target.value });
              }}
              className="w-full max-w-64 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            />
          </div>
        )}
      </section>

      {available.length > 0 && (
        <section className="rounded-2xl border border-dashed border-line p-4" aria-labelledby="plan-available">
          <button type="button" onClick={() => setShowAvailable(!showAvailable)} className="flex w-full items-center justify-between text-left" aria-expanded={showAvailable}>
            <span>
              <span id="plan-available" className="block text-sm font-semibold">
                Available now ({available.length})
              </span>
              <span className="block text-xs text-muted">You could buy these on the site today. Pick one if Scout should wait for a lower price or a set time.</span>
            </span>
            <span className="text-xs text-muted">{showAvailable ? "Hide" : "Show"}</span>
          </button>
          {showAvailable && (
            <div className="mt-3 flex flex-wrap gap-2">
              {available.map((c) => (
                <button key={c.id} type="button" aria-pressed={ids.includes(c.id)} onClick={() => toggle(c.id)} className={chip(ids.includes(c.id))}>
                  {labels.get(c.id)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
