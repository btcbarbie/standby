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
    <div className="relative hidden h-16 lg:block" aria-hidden>
      <div className={`absolute left-1/2 w-px bg-[#c9cfd9] ${join ? "bottom-0 top-1/2" : "top-0 h-1/2"}`} />
      <div className="absolute left-[16.66%] right-[16.66%] top-1/2 h-px bg-[#c9cfd9]" />
      {[16.66, 50, 83.33].map((x) => (
        <div key={x} className={`absolute w-px bg-[#c9cfd9] ${join ? "top-0 h-1/2" : "bottom-0 top-1/2"}`} style={{ left: `${x}%` }} />
      ))}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-1 text-xs font-semibold text-ink/80 shadow-sm">
        {label}
      </span>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "ai" | "code" | "human" }) {
  const cls = {
    ai: "bg-ink text-white",
    code: "bg-[#fde2df] text-[#b42318]",
    human: "bg-brand-soft text-brand",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${cls}`}>{children}</span>;
}

function Member({ who, tag, tone, quote, children }: { who: Who; tag: string; tone: "ai" | "code"; quote: string; children?: React.ReactNode }) {
  const c = CAST[who];
  return (
    <article className="flex flex-col rounded-3xl border-2 p-5" style={{ borderColor: `${c.color}55`, background: c.soft }}>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
          <Character who={who} mood={who === "vault" ? "stern" : who === "banker" ? "thinking" : "happy"} size={68} />
        </div>
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tight" style={{ color: c.color }}>
            {c.name}
          </h3>
          <div className="mt-1">
            <Tag tone={tone}>{tag}</Tag>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/85">“{quote}”</p>
      {children}
    </article>
  );
}

function ScoutBrowser() {
  return (
    <form action="/app/new" method="get" className="mt-4 overflow-hidden rounded-2xl border border-[#f3cf96] bg-white text-left">
      <div className="flex items-center gap-1.5 border-b border-line bg-[#fbfaf7] px-3 py-1.5" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-1.5 text-[11px] font-medium text-muted">Scout&apos;s browser</span>
      </div>
      <div className="flex gap-2 p-2">
        <label htmlFor="scout-url" className="sr-only">
          Paste a shopping link for Scout
        </label>
        <input
          id="scout-url"
          name="url"
          type="url"
          required
          placeholder="Paste a shopping link…"
          className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-ink"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-scout px-3 py-2 text-sm font-bold text-white hover:brightness-95">
          Send Scout
        </button>
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">Shopping pages that accept PayPal only.</p>
    </form>
  );
}

const OUTCOMES = [
  { title: "Yes → Purchase", note: "All three agree", cls: "border-[#a6e9c1] bg-good-soft text-good", icon: "✓" },
  { title: "No → Block or skip", note: "The Vault says no, or both AIs pass", cls: "border-[#f9c4be] bg-bad-soft text-bad", icon: "✕" },
  { title: "Unsure → Ask you", note: "Scout and Banker disagree", cls: "border-[#c7d6ff] bg-brand-soft text-brand", icon: "?" },
];

export default function StoryBoard({ scoutMaker }: { scoutMaker: string }) {
  const sameCompany = scoutMaker === "Claude";
  return (
    <div className="rounded-[2rem] border border-line bg-[#fbfaf7] px-4 py-8 sm:px-8 lg:px-10 lg:py-10" role="group" aria-label="How Standby pays">
      {/* You */}
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-3xl border-2 border-[#c7d6ff] bg-white p-5 text-center sm:flex-row sm:text-left">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-soft">
          <Character who="you" size={68} />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-2xl font-black uppercase tracking-tight text-brand">You</h3>
            <Tag tone="human">Human</Tag>
          </div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink/85">
            “I paste the exact link, tick the size or seat, and set the most I&apos;ll pay and a deadline. Those are the rules.”
          </p>
        </div>
      </div>

      <Branch label="Your rules go to each one separately" />
      <Down className="my-2 lg:hidden" />

      {/* The three checks: same rules, no contact with each other */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Member
          who="scout"
          tag={`AI · ${scoutMaker}`}
          tone="ai"
          quote="I read the one shopping page you gave me and tell you when an offer fits your rules. I find. I can't pay."
        >
          <ScoutBrowser />
        </Member>
        <Member
          who="banker"
          tag="AI · Claude"
          tone="ai"
          quote={`I check the same offer against your rules on my own. I don't know anyone else looked at it${sameCompany ? "" : ", and I'm made by a different company"}. I spot tricks. I can't pay.`}
        />
        <Member
          who="vault"
          tag="Not AI"
          tone="code"
          quote="I'm plain code. I don't read pages or take advice. Exact item, quantity, total with fees, the hold, the deadline. Numbers only."
        />
      </div>

      <Branch label="Do all three agree?" join />
      <Down className="my-2 lg:hidden" />

      <ul className="grid gap-3 sm:grid-cols-3">
        {OUTCOMES.map((o) => (
          <li key={o.title} className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${o.cls}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-base font-black" aria-hidden>
              {o.icon}
            </span>
            <span>
              <span className="block text-[15px] font-bold">{o.title}</span>
              <span className="block text-xs opacity-80">{o.note}</span>
            </span>
          </li>
        ))}
      </ul>

      <Down className="my-2" />

      {/* PayPal */}
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-3xl border-2 border-[#b9d4f5] bg-white p-5 text-center sm:flex-row sm:text-left">
        <div className="shrink-0 text-3xl font-black italic tracking-tight sm:border-r sm:border-line sm:pr-5">
          <span className="text-[#003087]">Pay</span>
          <span className="text-[#0070e0]">Pal</span>
        </div>
        <p className="text-[15px] leading-relaxed text-ink/85">
          Only on a yes does PayPal take the money, from the hold you approved and never more than it. Nobody on the team can touch it on their own.
        </p>
      </div>
    </div>
  );
}
