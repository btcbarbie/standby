import Character, { CAST, type Who } from "./Character";

// The homepage hero's right side: how Standby decides, as one calm vertical flow.
// You set the rules → Scout, the Banker and the Vault each check them on their own → the decision → PayPal.

function Tag({ children, tone }: { children: React.ReactNode; tone: "ai" | "code" | "human" }) {
  const cls = {
    ai: "bg-ink text-white",
    code: "bg-[#fde2df] text-[#b42318]",
    human: "bg-brand-soft text-brand",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{children}</span>;
}

// One numbered step on the flow line.
function Step({ n, title, children, last = false }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative pl-11">
      {!last && <span className="absolute bottom-[-1rem] left-[13px] top-8 w-px bg-[#d6dbe3]" aria-hidden />}
      <span className="absolute left-0 top-0.5 grid h-7 w-7 place-items-center rounded-full border border-line bg-white text-xs font-bold text-muted shadow-sm" aria-hidden>
        {n}
      </span>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-2">{children}</div>
    </li>
  );
}

// One of the three checks, as a row: the character, who it is, what it is (AI or code), and its job.
function Check({ who, tags, tone, text, children }: { who: Who; tags: string[]; tone: "ai" | "code"; text: string; children?: React.ReactNode }) {
  const c = CAST[who];
  return (
    <div className="flex gap-3.5 px-4 py-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: c.soft }}>
        <Character who={who} mood={who === "vault" ? "stern" : who === "banker" ? "thinking" : "happy"} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-black uppercase tracking-tight" style={{ color: c.color }}>
            {c.name}
          </span>
          {tags.map((t) => (
            <Tag key={t} tone={tone}>
              {t}
            </Tag>
          ))}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">{text}</p>
        {children}
      </div>
    </div>
  );
}

// Scout's own little link box, so you can hand Scout a page right here too.
function ScoutBrowser() {
  return (
    <form action="/app/new" method="get" className="mt-2.5 flex max-w-sm gap-1.5">
      <label htmlFor="scout-url" className="sr-only">
        Paste a shopping link for Scout
      </label>
      <input
        id="scout-url"
        name="url"
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        required
        placeholder="Paste a link for Scout…"
        className="min-w-0 flex-1 rounded-lg border border-[#f3cf96] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-scout"
      />
      <button type="submit" className="shrink-0 rounded-lg bg-scout px-3 py-1.5 text-xs font-bold text-white hover:brightness-95">
        Send Scout
      </button>
    </form>
  );
}

const OUTCOMES = [
  { title: "Yes → Purchase", note: "All three agree", cls: "bg-good-soft text-good", icon: "✓" },
  { title: "No → Block or skip", note: "The Vault says no, or both AIs pass", cls: "bg-bad-soft text-bad", icon: "✕" },
  { title: "Unsure → Ask you", note: "Scout and Banker disagree", cls: "bg-brand-soft text-brand", icon: "?" },
];

export default function StoryBoard({ scoutMaker }: { scoutMaker: string }) {
  return (
    <ol className="space-y-4" aria-label="How Standby pays">
      <Step n={1} title="You">
        <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-sm">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft">
            <Character who="you" size={40} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black uppercase tracking-tight text-brand">You</span>
              <Tag tone="human">Human</Tag>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">
              Copy the link to the exact product or ticket you want, give it to Scout, and set your conditions, price limit, and deadline.
            </p>
          </div>
        </div>
      </Step>

      <Step n={2} title="Three separate checks · each gets your rules on its own">
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <Check who="scout" tags={[`AI · ${scoutMaker}`]} tone="ai" text="Monitors your chosen page and alerts when your conditions are met.">
            <ScoutBrowser />
          </Check>
          <Check who="banker" tags={["AI · Claude"]} tone="ai" text="Independently checks the offer against your original instructions before approving it." />
          <Check who="vault" tags={["Hardcoded rules", "Not AI"]} tone="code" text="Enforces your purchasing rules and blocks any offer that violates them." />
        </div>
      </Step>

      <Step n={3} title="Do all three agree? Only a yes reaches PayPal" last>
        <ul className="grid grid-cols-3 gap-2">
          {OUTCOMES.map((o) => (
            <li key={o.title} className={`rounded-lg px-2.5 py-1.5 ${o.cls}`}>
              <span className="block text-xs font-bold leading-tight">
                <span aria-hidden>{o.icon} </span>
                {o.title}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug opacity-80">{o.note}</span>
            </li>
          ))}
        </ul>
        {/* The one path to money: Yes, straight down into PayPal. */}
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          <div className="flex justify-center">
            <svg viewBox="0 0 16 34" className="h-8 w-4 text-good">
              <path d="M8 0v28M2.5 22.5 8 29l5.5-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-2xl bg-gradient-to-br from-[#003087] to-[#0070e0] px-4 py-3.5 text-white shadow-md">
          <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-lg font-black italic tracking-tight shadow-sm">
            <span className="text-[#003087]">Pay</span>
            <span className="text-[#009cde]">Pal</span>
          </span>
          <p className="text-sm leading-relaxed text-white/90">Processes payment only when all three checks pass.</p>
        </div>
      </Step>
    </ol>
  );
}
