import Character, { CAST, type Who } from "@/components/Character";
import { money } from "@/lib/format";
import { StateChip, priceLine, recordedOn, runOf, vaultLine } from "./shared";

// The hero panel: one recorded run of the real system (Scout, the Banker and the Vault on a demo-store ticket).
export default function DecisionPreview() {
  const r = runOf("match");
  const rows: { who: Who; by: string; verdict: string; ok: boolean; line: string }[] = [
    { who: "scout", by: r.scout.by ?? "AI", verdict: r.scout.yes ? "Match" : "No match", ok: r.scout.yes, line: r.scout.line },
    { who: "banker", by: r.banker.by ?? "AI", verdict: r.banker.verdict === "APPROVE" ? "Approves" : "Rejects", ok: r.banker.verdict === "APPROVE", line: r.banker.line },
    { who: "vault", by: "code, not AI", verdict: r.vault.pass ? "Within limits" : "Blocked", ok: r.vault.pass, line: vaultLine(r) },
  ];

  return (
    <figure className="rounded-3xl border border-line bg-white p-5 shadow-[0_24px_60px_-32px_rgba(14,21,37,0.35)] sm:p-6" aria-labelledby="preview-caption">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Demo · recorded run</span>
        <span className="text-xs text-muted">{recordedOn}</span>
      </div>

      <div className="mt-4 rounded-2xl bg-bg p-4">
        <div className="text-sm font-semibold">1 left-wing ticket, under {money(4000)}</div>
        <div className="mt-0.5 text-xs text-muted">Nova Adé · Harbour Arena · on the Tixora demo store</div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
          <span className="text-sm font-medium">{r.offer.name}</span>
          <span className="tabular text-sm">
            {priceLine(r)} <span className="text-muted">· ceiling {money(4000)}</span>
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.who} className="flex gap-3">
            <Character who={row.who} mood={row.ok ? "happy" : "stern"} size={40} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="font-semibold" style={{ color: CAST[row.who].color }}>
                  {CAST[row.who].name}
                </span>
                <span className="text-muted">{row.by}</span>
                <span className={`ml-auto font-semibold ${row.ok ? "text-good" : "text-bad"}`}>
                  {row.ok ? "✓" : "✕"} {row.verdict}
                </span>
              </div>
              <p className="mt-1 rounded-2xl rounded-tl-md px-3 py-2 text-[14px] leading-snug" style={{ background: CAST[row.who].soft }}>
                {row.line}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <figcaption id="preview-caption" className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4 text-sm">
        <StateChip state={r.outcome} size="md" />
        <span className="text-muted">Alert mode: you were told, and you approve the payment. In Buy mode, the same result pays from your PayPal hold.</span>
      </figcaption>
    </figure>
  );
}
