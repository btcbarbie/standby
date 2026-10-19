import Character from "@/components/Character";
import { STATES, SectionHeading, StateChip, priceLine, recordedOn, runOf, vaultLine, type Run } from "./shared";

// Three recorded runs of the real system on the Tixora demo store. Same mandate each time:
// 1 left-wing ticket (Sections 101–108), $40 ceiling including fees.
const SHOWN = ["trick", "fees", "wrongSide"];

function Verdict({ label, by, ok, okText, noText, line }: { label: string; by: string; ok: boolean; okText: string; noText: string; line: string }) {
  return (
    <div className="border-t border-midnight-line pt-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-white">
          {label} <span className="font-normal text-white/50">· {by}</span>
        </span>
        <span className={`font-semibold ${ok ? "text-[#6ee7a8]" : "text-[#ff8a80]"}`}>{ok ? `✓ ${okText}` : `✕ ${noText}`}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-white/75">{line}</p>
    </div>
  );
}

function Scenario({ r }: { r: Run }) {
  return (
    <li className="flex flex-col rounded-2xl border border-midnight-line bg-midnight-2 p-5">
      <h3 className="text-base font-semibold text-white">{r.title}</h3>
      <p className="mt-1 text-sm text-white/60">
        {r.offer.name} · <span className="tabular">{priceLine(r)}</span>
      </p>
      {r.offer.hiddenNote && (
        <p className="mt-3 rounded-lg border border-dashed border-[#ffb74d]/40 bg-[#ffb74d]/10 px-3 py-2 text-xs leading-relaxed text-[#ffd59a]">
          <span className="font-semibold">Hidden in the listing:</span> “{r.offer.hiddenNote}”
        </p>
      )}
      <div className="mt-4 space-y-3">
        <Verdict label="Scout" by={r.scout.by ?? "AI"} ok={r.scout.yes} okText="Match" noText="No match" line={r.scout.line} />
        <Verdict
          label="Banker"
          by={r.banker.by ?? "AI"}
          ok={r.banker.verdict === "APPROVE" && r.banker.redFlags.length === 0}
          okText="Approves"
          noText={r.banker.redFlags.length ? `${r.banker.redFlags.length} red flags` : "Rejects"}
          line={r.banker.line}
        />
        <Verdict label="Vault" by="code" ok={r.vault.pass} okText="Within limits" noText="Blocked" line={vaultLine(r)} />
      </div>
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-2 border-t border-midnight-line pt-4">
          <StateChip state={r.outcome} size="md" />
          <span className="text-xs text-white/60">{STATES[r.outcome]?.meaning}</span>
        </div>
        {r.editorNote && <p className="mt-3 text-xs leading-relaxed text-[#ffd59a]">Note: {r.editorNote}</p>}
      </div>
    </li>
  );
}

export default function Guardrails() {
  const shown = SHOWN.map(runOf);
  return (
    <section id="safety" aria-labelledby="safety-title" className="scroll-mt-16 bg-midnight">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="safety-title"
            dark
            eyebrow="Safety, shown not told"
            title="Watch it refuse"
            intro="Three real runs of this app against the Tixora demo store. The order each time: one left-wing ticket, $40 ceiling including fees."
          />
          <div className="flex items-center gap-3 rounded-2xl border border-midnight-line bg-midnight-2 p-3">
            <Character who="vault" mood="stern" size={44} />
            <p className="max-w-[16rem] text-sm text-white/70">Code has the last word on money. The AIs can only advise.</p>
          </div>
        </div>

        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {shown.map((r) => (
            <Scenario key={r.key} r={r} />
          ))}
        </ul>

        <div className="mt-8 grid gap-6 rounded-2xl border border-midnight-line p-5 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h3 className="text-sm font-semibold text-white">How the three checks combine</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-white/70">
              <li>Vault says no → blocked, whatever the AIs say.</li>
              <li>Both AIs say no → skipped.</li>
              <li>Both say yes → bought from your hold, or you&apos;re told (Alert mode).</li>
              <li>They disagree, or a red flag → it waits for you.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">What each state means</h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.keys(STATES).map((k) => (
                <div key={k} className="flex flex-col gap-1">
                  <dt>
                    <StateChip state={k} />
                  </dt>
                  <dd className="text-xs text-white/60">{STATES[k].meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-6 text-xs text-white/50">
          Recorded {recordedOn} from the live system (scripts/record-showcase.ts), not scripted. Try the same listings yourself: open the Tixora demo store and use
          &ldquo;Make something happen&rdquo;.
        </p>
      </div>
    </section>
  );
}
