import Character, { CAST, type Who } from "./Character";

// The homepage hero: Standby's whole payment workflow as one picture.
// You set the rules → Scout, Banker and Vault each check them on their own → one outcome → PayPal.

function Down({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center text-[#b8bfcc] ${className}`} aria-hidden>
      <svg viewBox="0 0 24 32" className="h-8 w-6">
        <path d="M12 2v26M5 21l7 8 7-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// One line splitting into (or joining from) three columns, with a label on it. Wide screens only.
function Branch({ label, join = false }: { label: string; join?: boolean }) {
  return (
    <div className="relative hidden h-12 lg:block" aria-hidden>
      <div className={`absolute left-1/2 w-px bg-[#c9cfd9] ${join ? "bottom-0 top-1/2" : "top-0 h-1/2"}`} />
      <div className="absolute left-[16.66%] right-[16.66%] top-1/2 h-px bg-[#c9cfd9]" />
      {[16.66, 50, 83.33].map((x) => (
        <div key={x} className={`absolute w-px bg-[#c9cfd9] ${join ? "top-0 h-1/2" : "bottom-0 top-1/2"}`} style={{ left: `${x}%` }} />
      ))}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-white px-3 py-0.5 text-[11px] font-semibold text-ink/80 shadow-sm">
        {label}
      </span>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "ai" | "code" | "human" | "pay" }) {
  const cls = {
    ai: "bg-ink text-white",
    code: "bg-[#fde2df] text-[#b42318]",
    human: "bg-brand-soft text-brand",
    pay: "bg-[#e8f1fd] text-[#003087]",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{children}</span>;
}

// One part of the team: who it is, what it is (AI, code, you), and its one job.
function Member({ who, tag, tone, text, className = "" }: { who: Who; tag: string; tone: "ai" | "code" | "human"; text: string; className?: string }) {
  const c = CAST[who];
  return (
    <article className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${className}`} style={{ borderColor: `${c.color}55`, background: who === "you" ? "#fff" : c.soft }}>
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
        <Character who={who} mood={who === "vault" ? "stern" : who === "banker" ? "thinking" : "happy"} size={40} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-base font-black uppercase tracking-tight" style={{ color: c.color }}>
            {c.name}
          </h3>
          <Tag tone={tone}>{tag}</Tag>
        </div>
        <p className="mt-1 text-sm leading-snug text-ink/85">{text}</p>
      </div>
    </article>
  );
}

const OUTCOMES = [
  { title: "Yes → Purchase", note: "All three agree", cls: "border-[#a6e9c1] bg-good-soft text-good", icon: "✓" },
  { title: "No → Block or skip", note: "The Vault says no, or both AIs pass", cls: "border-[#f9c4be] bg-bad-soft text-bad", icon: "✕" },
  { title: "Unsure → Ask you", note: "Scout and Banker disagree", cls: "border-[#c7d6ff] bg-brand-soft text-brand", icon: "?" },
];

export default function StoryBoard({ scoutMaker }: { scoutMaker: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-[#fbfaf7] px-4 py-6 sm:px-6 lg:px-8" role="group" aria-label="How Standby pays">
      <Member
        who="you"
        tag="Human"
        tone="human"
        className="mx-auto max-w-2xl"
        text="Copy the link to the exact product or ticket you want, give it to Scout, and set your conditions, price limit, and deadline."
      />

      <Branch label="Your rules go to each one separately" />
      <Down className="my-1.5 lg:hidden" />

      {/* The three checks: same rules, no contact with each other */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Member who="scout" tag={`AI · ${scoutMaker}`} tone="ai" text="Monitors your chosen page and alerts when your conditions are met." />
        <Member who="banker" tag="AI · Claude" tone="ai" text="Independently checks the offer against your original instructions before approving it." />
        <Member who="vault" tag="Hardcoded rules · Not AI" tone="code" text="Enforces your purchasing rules and blocks any offer that violates them." />
      </div>

      <Branch label="Do all three agree?" join />
      <Down className="my-1.5 lg:hidden" />

      <ul className="grid gap-2 sm:grid-cols-3">
        {OUTCOMES.map((o) => (
          <li key={o.title} className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 ${o.cls}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-sm font-black" aria-hidden>
              {o.icon}
            </span>
            <span>
              <span className="block text-sm font-bold">{o.title}</span>
              <span className="block text-[11px] opacity-80">{o.note}</span>
            </span>
          </li>
        ))}
      </ul>

      <Down className="my-1.5" />

      {/* PayPal */}
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border-2 border-[#b9d4f5] bg-white p-4">
        <div className="shrink-0 text-xl font-black italic tracking-tight">
          <span className="text-[#003087]">Pay</span>
          <span className="text-[#0070e0]">Pal</span>
        </div>
        <div className="min-w-0 border-l border-line pl-3">
          <Tag tone="pay">Payment</Tag>
          <p className="mt-1 text-sm leading-snug text-ink/85">Processes payment only when all three checks pass.</p>
        </div>
      </div>
    </div>
  );
}
