import type { PageData } from "./page";

// Turns a page read into what Scout shows you: colours, sizes (sold out marked), or the tickets on sale.
// Plain code, no AI, so it shows only what the page's own data says.

export type Chip = { text: string; inStock: boolean; url?: string; here?: boolean };
export type Group = { label: string; chips: Chip[] };
export type Ticket = { label: string; priceCents: number; seller: string };
export type Extracted = { groups: Group[]; tickets: Ticket[] };

const SIZE = /^(?:size\s+)?(\d+(?:\.\d+)?|xxs|xs|s|m|l|xl|xxl|xxxl|\dxl|one size|os)$/i;

export function splitOption(label: string): { colour: string; size: string | null } {
  const parts = label.split(/\s+-\s+|\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  const sizePart = parts.find((p) => SIZE.test(p)) ?? null;
  return {
    size: sizePart ? sizePart.replace(/^size\s+/i, "") : null,
    colour: parts.filter((p) => p !== sizePart).join(" ").replace(/^colou?r\s+/i, ""),
  };
}

// The option's name without the product's own name in front.
export function optionLabel(page: Pick<PageData, "name">, name: string) {
  return name.startsWith(`${page.name} - `) ? name.slice(page.name.length + 3) : name;
}

export function extract(page: PageData): Extracted {
  if (page.kind === "TICKET") {
    return {
      groups: [],
      tickets: page.offers.filter((o) => o.inStock).map((o) => ({ label: o.name, priceCents: o.priceCents, seller: o.seller })),
    };
  }
  const options = page.offers.map((o) => ({ ...splitOption(optionLabel(page, o.name)), inStock: o.inStock, label: optionLabel(page, o.name) }));
  const colours = [...new Set(options.map((o) => o.colour).filter(Boolean))];
  const sized = options.some((o) => o.size);
  const groups: Group[] = [];
  const otherColours = page.siblings.map((s) => ({ text: s.label, inStock: true, url: s.url }));

  if (!sized) {
    groups.push({ label: "Options", chips: options.map((o) => ({ text: o.label, inStock: o.inStock })) });
    if (otherColours.length) groups.push({ label: "Other colours", chips: otherColours });
    return { groups, tickets: [] };
  }

  if (colours.length <= 1) {
    // One colour on this page (the store lists other colours on their own pages).
    const here = colours[0] || page.thisColour;
    if (here || otherColours.length) {
      groups.push({ label: "Colours", chips: [...(here ? [{ text: here, inStock: options.some((o) => o.inStock), here: true }] : []), ...otherColours] });
    }
    groups.push({ label: "Sizes", chips: options.map((o) => ({ text: o.size ?? o.label, inStock: o.inStock })) });
  } else {
    // Several colours on one page: sizes per colour, because stock differs by colour.
    groups.push({ label: "Colours", chips: [...colours.map((c) => ({ text: c, inStock: options.some((o) => o.colour === c && o.inStock) })), ...otherColours] });
    for (const c of colours) {
      groups.push({ label: `${c} sizes`, chips: options.filter((o) => o.colour === c).map((o) => ({ text: o.size ?? o.label, inStock: o.inStock })) });
    }
  }
  return { groups, tickets: [] };
}

// ---------- Locks: details a listing must have, checked in code ----------
// Every site describes its listings differently (section and row, seat, seller, size, colour, date...).
// These read whatever details a listing's own data shows, so a lock works on any site that shows that detail.

export type Lock = { field: string; values: string[] };

const FIELD_WORDS: Record<string, string> = {
  section: "section", sec: "section", row: "row", seat: "seat", seats: "seat", zone: "zone", tier: "tier", level: "level",
  block: "block", area: "area", stand: "stand", gate: "gate", size: "size", colour: "colour", color: "colour",
  date: "date", day: "date", time: "time", type: "type",
};

export function offerFields(page: Pick<PageData, "name" | "kind">, offer: { name: string; seller?: string }): Record<string, string> {
  const out: Record<string, string> = {};
  const loose: string[] = [];
  for (const part of optionLabel(page, offer.name).split(/\s+·\s+|\s+-\s+|\s+\/\s+|,\s+/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z]+)\s+(.+)$/);
    const key = m ? FIELD_WORDS[m[1].toLowerCase()] : undefined;
    if (key && !out[key]) out[key] = m![2].trim();
    else loose.push(part);
  }
  for (const part of loose) {
    if (page.kind === "TICKET") out.type ??= part;
    else if (!out.size && SIZE.test(part)) out.size = part.replace(/^size\s+/i, "");
    else out.colour ??= part.replace(/^colou?r\s+/i, "");
  }
  if (offer.seller) out.seller = offer.seller;
  return out;
}

// Each detail the listings on this page have, with the values seen (a seller only counts when there's more than one).
export function pageFields(page: PageData): Record<string, string[]> {
  const seen: Record<string, Set<string>> = {};
  for (const o of page.offers) for (const [k, v] of Object.entries(offerFields(page, o))) (seen[k] ??= new Set()).add(v);
  const out: Record<string, string[]> = {};
  for (const [k, vals] of Object.entries(seen)) if (k !== "seller" || vals.size > 1) out[k] = [...vals].slice(0, 40);
  return out;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Keep only locks on details this page actually has, spelled the way the page spells them where it can.
export function cleanLocks(page: PageData, raw: unknown): Lock[] {
  const fields = pageFields(page);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ field: String(l?.field ?? "").toLowerCase(), values: Array.isArray(l?.values) ? l.values.map((v: unknown) => String(v).trim()).filter(Boolean) : [] }))
    .filter((l) => fields[l.field] && l.values.length)
    .map((l) => ({ field: l.field, values: [...new Set(l.values.map((v: string) => fields[l.field].find((p) => same(p, v)) ?? v))].slice(0, 40) as string[] }));
}

export function meetsLocks(page: Pick<PageData, "name" | "kind">, offer: { name: string; seller?: string }, locks: Lock[]) {
  const f = offerFields(page, offer);
  const misses = locks.filter((l) => !(f[l.field] && l.values.some((v) => same(v, f[l.field]))));
  return { ok: misses.length === 0, fields: f, misses };
}

// "section 101–108" for a run of numbers, otherwise the values themselves.
export function describeLocks(locks: Lock[]) {
  return locks
    .map((l) => {
      const n = l.values.map(Number);
      const run = n.length > 2 && n.every((x, i) => Number.isInteger(x) && (i === 0 || x === n[i - 1] + 1));
      return `${l.field} ${run ? `${l.values[0]}–${l.values[l.values.length - 1]}` : l.values.length > 6 ? `${l.values.slice(0, 6).join(", ")}…` : l.values.join(", ")}`;
    })
    .join(" · ");
}
