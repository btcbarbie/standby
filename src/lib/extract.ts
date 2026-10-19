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
