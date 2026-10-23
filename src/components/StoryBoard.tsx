import Character, { CAST, type Who } from "./Character";

// The homepage hero: Standby's whole payment workflow as one picture.
// You set the rules → Scout, Banker and Vault each check them on their own → one outcome → PayPal.

function Down({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center text-[#b8bfcc] ${className}`} aria-hidden>
      <svg viewBox="0 0 24 32" className="h-6 w-5">
        <path d="M12 2v26M5 21l7 8 7-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// One line splitting into (or joining from) three columns, with a label on it. Wide screens only.
function Branch({ label, join = false }: { label: string; join?: boolean }) {
  return (
    <div className="relative hidden h-9 lg:block" aria-hidden>
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

// One part of the team, as a squarish card: the character on top, then who it is, what it is (AI, code, you), and its job.
function Member({
  who,
  tag,
  tone,
  text,
  className = "",
  children,
}: {
  who: Who;
  tag: string;
  tone: "ai" | "code" | "human";
  text: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const c = CAST[who];
  return (
    <article
      className={`flex flex-col items-center rounded-2xl border-2 p-3 text-center ${className}`}
      style={{ borderColor: `${c.color}55`, background: who === "you" ? "#fff" : c.soft }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-sm">
        <Character who={who} mood={who === "vault" ? "stern" : who === "banker" ? "thinking" : "happy"} size={40} />
      </div>
      <h3 className="mt-1.5 text-[15px] font-black uppercase leading-none tracking-tight" style={{ color: c.color }}>
        {c.name}
      </h3>
      <div className="mt-1">
        <Tag tone={tone}>{tag}</Tag>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-ink/85">{text}</p>
      {children}
    </article>
  );
}

// Scout's own little browser: paste a link here too.
function ScoutBrowser() {
  return (
    <form action="/app/new" method="get" className="mt-3 w-full overflow-hidden rounded-xl border border-[#f3cf96] bg-white text-left">
      <div className="flex items-center gap-1 border-b border-line bg-[#fbfaf7] px-2 py-1" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
        <span className="ml-1 text-[10px] font-medium text-muted">Scout&apos;s browser</span>
      </div>
      <div className="flex gap-1 p-1.5">
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
          placeholder="Paste a link…"
          className="w-full min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-ink"
        />
        <button type="submit" aria-label="Send Scout" className="shrink-0 rounded-lg bg-scout px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-95">
          Send
        </button>
      </div>
    </form>
  );
}

const OUTCOMES = [
  { title: "Yes → Purchase", note: "All three agree", cls: "border-[#a6e9c1] bg-good-soft text-good", icon: "✓" },
  { title: "No → Block or skip", note: "The Vault says no, or both AIs pass", cls: "border-[#f9c4be] bg-bad-soft text-bad", icon: "✕" },
  { title: "Unsure → Ask you", note: "Scout and Banker disagree", cls: "border-[#c7d6ff] bg-brand-soft text-brand", icon: "?" },
];

export default function StoryBoard({ scoutMaker }: { scoutMaker: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-[#fbfaf7] px-4 py-4 sm:px-5" role="group" aria-label="How Standby pays">
      <Member
        who="you"
        tag="Human"
        tone="human"
        className="mx-auto max-w-md"
        text="Copy the link to the exact product or ticket you want, give it to Scout, and set your conditions, price limit, and deadline."
      />

      <Branch label="Your rules go to each one separately" />
      <Down className="my-1 lg:hidden" />

      {/* The three checks: same rules, no contact with each other */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Member who="scout" tag={`AI · ${scoutMaker}`} tone="ai" text="Monitors your chosen page and alerts when your conditions are met.">
          <ScoutBrowser />
        </Member>
        <Member who="banker" tag="AI · Claude" tone="ai" text="Independently checks the offer against your original instructions before approving it." />
        <Member who="vault" tag="Hardcoded rules · Not AI" tone="code" text="Enforces your purchasing rules and blocks any offer that violates them." />
      </div>

      <Branch label="Do all three agree?" join />
      <Down className="my-1 lg:hidden" />

      <ul className="grid gap-2 sm:grid-cols-3">
        {OUTCOMES.map((o) => (
          <li key={o.title} className={`rounded-xl border-2 px-2 py-1.5 text-center ${o.cls}`}>
            <span className="block text-[13px] font-bold">
              <span aria-hidden>{o.icon} </span>
              {o.title}
            </span>
            <span className="block text-[11px] leading-tight opacity-80">{o.note}</span>
          </li>
        ))}
      </ul>

      <Down className="my-0.5" />

      {/* PayPal, in PayPal's own colours */}
      <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl bg-gradient-to-br from-[#003087] to-[#0070e0] p-3 text-center text-white shadow-md">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-white px-2.5 py-0.5 text-lg font-black italic tracking-tight shadow-sm">
            <span className="text-[#003087]">Pay</span>
            <span className="text-[#009cde]">Pal</span>
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Payment</span>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-white/90">Processes payment only when all three checks pass.</p>
      </div>
    </div>
  );
}
