import showcase from "@/data/showcase.json";
import { money } from "@/lib/format";

// Recorded runs of the real system (scripts/record-showcase.ts). The homepage only ever shows what these returned.
export type Run = (typeof showcase.runs)[number] & { editorNote?: string };
export const runs = showcase.runs as Run[];
export const runOf = (key: string) => runs.find((r) => r.key === key)!;
export const recordedOn = new Date(showcase.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const models = showcase.models;

export const DEMO_HREF = "/start?next=/app";

export function totalOf(r: Run) {
  return r.offer.priceCents + r.offer.feeCents;
}

export function priceLine(r: Run) {
  return `${money(r.offer.priceCents)} + ${money(r.offer.feeCents)} fee = ${money(totalOf(r))}`;
}

// The Vault's own words, with the long allowed-section list shortened for display.
export function vaultLine(r: Run) {
  return r.vault.line.replace(/isn't one of: Section 101(, Section \d+)+\./, "isn't in your allowed list (Sections 101–108).");
}

// Outcome states, kept distinct everywhere on the page.
export const STATES: Record<string, { label: string; tone: string; icon: string; meaning: string }> = {
  FOUND: { label: "Found it", tone: "bg-good-soft text-good", icon: "★", meaning: "All three agreed. In Alert mode you're told and you pay." },
  BOUGHT: { label: "Bought", tone: "bg-good-soft text-good", icon: "✓", meaning: "Shown only after PayPal confirms the capture." },
  BUYING: { label: "Paying…", tone: "bg-brand-soft text-brand", icon: "…", meaning: "All three agreed in Buy mode; waiting for PayPal." },
  NEEDS_YOU: { label: "Needs you", tone: "bg-warn-soft text-warn", icon: "✋", meaning: "The AIs disagreed or one raised a red flag." },
  BLOCKED: { label: "Blocked", tone: "bg-bad-soft text-bad", icon: "⛔", meaning: "A code limit failed. No money moves." },
  SKIPPED: { label: "Skipped", tone: "bg-vault-soft text-vault", icon: "→", meaning: "Both AIs passed on it." },
};

export function StateChip({ state, size = "sm" }: { state: string; size?: "sm" | "md" }) {
  const s = STATES[state] ?? STATES.SKIPPED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${s.tone} ${size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs"}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function SectionHeading({ id, eyebrow, title, intro, dark = false }: { id: string; eyebrow: string; title: string; intro?: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl">
      <p className={`text-sm font-semibold ${dark ? "text-[#8fb0ff]" : "text-brand"}`}>{eyebrow}</p>
      <h2 id={id} className={`mt-2 text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-tight ${dark ? "text-white" : ""}`}>
        {title}
      </h2>
      {intro && <p className={`mt-3 text-lg leading-relaxed ${dark ? "text-white/70" : "text-muted"}`}>{intro}</p>}
    </div>
  );
}
