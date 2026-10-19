"use client";

import { useMemo, useState } from "react";

// Everything Scout found at the link, as tappable chips: grouped into Colour / Size / Option rows when the
// option names allow it ("Jet Black - Size 8", "Green / 8"), otherwise one chip per option.
// Sold-out choices stay tappable: picking one means "watch for the restock".

export type Choice = { id: string; label: string; priceCents: number; inStock: boolean; seller: string };

const SPLIT = /\s+-\s+|\s+\/\s+|\s+·\s+/;
const SIZE_LIKE = /^(size\s+)?(\d+(\.\d+)?|x{0,3}[sml]|xx?l|[2-5]xl|one size)$/i;

type Group = { title: string; values: string[]; strip: (v: string) => string };

function buildGroups(choices: Choice[]): { groups: Group[]; parts: Map<string, string[]> } | null {
  if (choices.length < 2) return null;
  const parts = new Map(choices.map((c) => [c.id, c.label.split(SPLIT).map((p) => p.trim())]));
  const n = parts.get(choices[0].id)!.length;
  if (n < 1 || n > 3 || choices.some((c) => parts.get(c.id)!.length !== n)) return null;
  const groups: Group[] = [];
  for (let i = 0; i < n; i++) {
    const values = [...new Set(choices.map((c) => parts.get(c.id)![i]))];
    const sizeish = values.every((v) => SIZE_LIKE.test(v));
    const title = sizeish ? "Size" : n > 1 && i === 0 ? "Colour" : "Option";
    groups.push({ title, values, strip: (v) => (sizeish ? v.replace(/^size\s+/i, "") : v) });
  }
  return { groups, parts };
}

const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export default function OptionPicker({
  productName,
  choices,
  onChange,
}: {
  productName: string;
  choices: Choice[];
  onChange: (ids: string[], sentence: string) => void;
}) {
  const built = useMemo(() => buildGroups(choices), [choices]);
  // A group with only one value (e.g. the only colour on the page) starts selected.
  const [sel, setSel] = useState<string[][]>(() => (built ? built.groups.map((g) => (g.values.length === 1 ? [g.values[0]] : [])) : []));
  const [flat, setFlat] = useState<string[]>([]);

  const matching = (selection: string[][]) =>
    built
      ? selection.some((s) => s.length) && built.groups.some((g, i) => g.values.length > 1 && selection[i].length)
        ? choices.filter((c) => selection.every((s, i) => s.length === 0 || s.includes(built.parts.get(c.id)![i])))
        : []
      : [];

  const picked = built ? matching(sel) : choices.filter((c) => flat.includes(c.id));

  function sentenceFor(ids: Choice[], selection?: string[][]) {
    if (ids.length === 0) return "";
    const bits = built && selection
      ? built.groups.map((g, i) => {
          const s = selection[i];
          if (!s.length) return null;
          const vals = s.map(g.strip);
          return g.title === "Size" ? `size ${vals.join(" or ")}` : vals.join(" or ");
        }).filter(Boolean)
      : ids.map((c) => c.label);
    const most = Math.max(...ids.map((c) => c.priceCents));
    return `${productName}, ${bits.join(", ")}. Up to ${dollars(most)}. Just one.`;
  }

  function toggleGroup(gi: number, value: string) {
    const next = sel.map((s, i) => (i === gi ? (s.includes(value) ? s.filter((v) => v !== value) : [...s, value]) : s));
    setSel(next);
    const ids = matching(next);
    onChange(ids.map((c) => c.id), sentenceFor(ids, next));
  }

  function toggleFlat(id: string) {
    const next = flat.includes(id) ? flat.filter((x) => x !== id) : [...flat, id];
    setFlat(next);
    const ids = choices.filter((c) => next.includes(c.id));
    onChange(ids.map((c) => c.id), sentenceFor(ids));
  }

  const chip = (on: boolean, soldOut: boolean, impossible: boolean) =>
    `rounded-xl border px-3 py-1.5 text-sm transition ${
      on ? "border-ink bg-ink text-white" : impossible ? "border-line text-muted/50" : soldOut ? "border-dashed border-line text-muted hover:border-ink" : "border-line bg-white hover:border-ink"
    }`;

  const inStock = picked.filter((c) => c.inStock).length;

  return (
    <div className="mt-2 rounded-2xl border border-line bg-bg p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Tap what you want</div>
      {built ? (
        built.groups.map((g, gi) => (
          <div key={gi} className="mt-3">
            <div className="text-sm font-semibold">{g.title}</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {g.values.map((v) => {
                const on = sel[gi].includes(v);
                // Would this value, with the other rows as chosen, give anything at all, and anything in stock?
                // Rows are read top-down: a colour is judged on its own, a size within the chosen colour.
                const trial = sel.map((s, i) => (i === gi ? [v] : i < gi ? s : []));
                const pool = choices.filter((c) => trial.every((s, i) => s.length === 0 || s.includes(built.parts.get(c.id)![i])));
                const impossible = pool.length === 0;
                const soldOut = !impossible && pool.every((c) => !c.inStock);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    disabled={impossible && !on}
                    onClick={() => toggleGroup(gi, v)}
                    title={soldOut ? "Sold out now: Scout will watch for a restock" : undefined}
                    className={chip(on, soldOut, impossible)}
                  >
                    {g.strip(v)}
                    {soldOut && <span className={`ml-1.5 text-[10px] font-semibold uppercase ${on ? "text-white/70" : "text-muted"}`}>sold out</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {choices.map((c) => {
            const on = flat.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleFlat(c.id)} className={chip(on, !c.inStock, false)}>
                {c.label}
                <span className={`ml-1.5 text-xs ${on ? "text-white/70" : "text-muted"}`}>{dollars(c.priceCents)}</span>
                {!c.inStock && <span className={`ml-1.5 text-[10px] font-semibold uppercase ${on ? "text-white/70" : "text-muted"}`}>sold out</span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted" aria-live="polite">
        {picked.length === 0
          ? "Pick what you want, or just describe it below."
          : `${picked.length} matching option${picked.length === 1 ? "" : "s"}: ${inStock} in stock now${
              picked.length - inStock ? `, ${picked.length - inStock} sold out (Scout will watch for a restock)` : ""
            }.`}
      </p>
    </div>
  );
}
