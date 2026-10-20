import Link from "next/link";
import Character from "@/components/Character";
import { Logo } from "@/components/ui";
import { scoutProvider } from "@/lib/ai";
import StoryBoard from "@/components/StoryBoard";
import DressArt from "@/components/DressArt";

export const dynamic = "force-dynamic";

// Two everyday situations Standby is built for, told start to finish.
const STORIES = [
  {
    key: "dress",
    tag: "Context-driven shopping",
    title: "The dress you already found",
    steps: [
      { who: "The moment", text: "You find a red dress you love on a shopping website, but your size is unavailable, or the price is too high." },
      {
        who: "You",
        text: "You paste the product link into Standby. It extracts the available sizes, price, product details and other relevant information. You tell it your size, preferred price and conditions.",
      },
      {
        who: "Standby",
        text: "Standby monitors the supported product page and waits for the right opportunity. If your size comes back in stock at an acceptable total price, it can proceed with the authorized purchase.",
      },
    ],
    promise: "You find the item. Standby watches for your opportunity.",
  },
  {
    key: "ticket",
    tag: "Time-sensitive purchasing",
    title: "The concert ticket you can't afford to miss",
    steps: [
      { who: "The moment", text: "Your favorite artist announces a concert. You find the official ticket page, but tickets are sold out." },
      {
        who: "You",
        text: "You give the link to Standby and tell it to watch for new tickets, with a maximum checkout total that includes applicable fees and taxes.",
      },
      {
        who: "Standby",
        text: "The moment new tickets appear, Standby checks each one against your conditions. If a ticket meets them and stays within the amount you approved, Standby buys it right away, even while you're asleep.",
      },
    ],
    promise: "Don't keep refreshing the page. Let Standby watch for you.",
  },
];

function TicketArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 110" className={className} aria-hidden>
      <path d="M14 18h172a6 6 0 0 1 6 6v20a12 12 0 0 0 0 24v20a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V68a12 12 0 0 0 0-24V24a6 6 0 0 1 6-6Z" fill="#1f4fd8" />
      <path d="M140 22v68" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeDasharray="5 5" />
      <rect x="26" y="36" width="90" height="10" rx="5" fill="#fff" opacity=".9" />
      <rect x="26" y="54" width="62" height="8" rx="4" fill="#fff" opacity=".55" />
      <rect x="26" y="68" width="74" height="8" rx="4" fill="#fff" opacity=".55" />
      <text x="166" y="62" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        A1
      </text>
    </svg>
  );
}

const NEVER = [
  "Spend more than the hold you approved in PayPal",
  "Buy anything other than the exact item you pointed at",
  "Buy more than you asked for, or buy twice",
  "Follow instructions hidden in a web page",
  "Wander to other pages or sites, or keep visiting after its time is up",
  "Hold your PayPal login or card details",
];

export default function Landing() {
  const twoCompanies = scoutProvider() === "Gemini";
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-5">
            <a href="#how" className="hidden text-sm font-medium text-muted hover:text-ink sm:block">
              How it works
            </a>
            <a href="#safety" className="hidden text-sm font-medium text-muted hover:text-ink sm:block">
              Safety
            </a>
            <Link href="/start?next=/app" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black">
              Try the demo
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-scout-soft px-3 py-1 text-xs font-semibold text-[#9a5d00]">
              <span className="h-1.5 w-1.5 rounded-full bg-scout" /> Your AI shopper. Your rules. Your money.
            </p>
            <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl">Give Standby the exact shopping link.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
              It watches the page diligently and acts when the right opportunity comes along, within the limits and requirements you set. Two independent
              AI checks review the purchase, while built-in safeguards enforce your limits before a purchase can proceed.
            </p>
          </div>
          <div className="mt-10">
            <StoryBoard scoutMaker={twoCompanies ? "Gemini" : "Claude"} />
          </div>
        </section>

        <section className="border-y border-line bg-bg" aria-labelledby="stories-title">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 id="stories-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Standby in real life
            </h2>
            <p className="mt-2 max-w-2xl text-muted">Two moments where you can&apos;t simply click Buy, and what Standby does about them.</p>
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {STORIES.map((st) => (
                <article key={st.key} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
                  <div className={`flex h-36 items-center justify-center ${st.key === "dress" ? "bg-[#fdecec]" : "bg-brand-soft"}`}>
                    {st.key === "dress" ? <DressArt color="#d63a3a" className="h-28 w-auto" /> : <TicketArt className="h-24 w-auto" />}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">{st.tag}</span>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">{st.title}</h3>
                    <ol className="mt-4 space-y-3">
                      {st.steps.map((step) => (
                        <li key={step.who}>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              step.who === "Standby" ? "bg-scout-soft text-[#9a5d00]" : step.who === "You" ? "bg-brand-soft text-brand" : "bg-bg text-muted"
                            }`}
                          >
                            {step.who}
                          </span>
                          <p className="mt-1 text-[15px] leading-relaxed text-ink/85">{step.text}</p>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-auto pt-5">
                      <span className="block rounded-xl bg-ink px-4 py-3 text-[15px] font-semibold text-white">
                        <span className="text-white/60">The promise: </span>
                        {st.promise}
                      </span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              ["Point and say", "Paste the link to the exact item or event. Say what you want in plain words: one ticket, left wing, under $40 with fees. Standby turns it into a checklist you confirm."],
              ["Choose: alert me, or buy for me", "Alert me: Standby tells you and you pay. Buy for me: PayPal holds the most you'll spend, nothing is taken until it matches, and the hold is released if nothing does."],
              ["Two yeses, or it waits", "When something turns up, Scout proposes it. The Banker checks it blind and the Vault runs its limits. Both yes: it's bought. A disagreement comes to you."],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-2xl border border-line p-6">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-banker">Good for stores, too</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">An AI shopper a store can say yes to</h2>
              <p className="mt-3 max-w-md text-muted">
                Stores block bots because they roam, scrape and hammer their pages. Standby agents are built to be welcome: they come for one thing, from one
                customer, and leave when they&apos;re done.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["One page, never browsing", "Locked to the link you gave it. It never follows links, searches or visits other sites."],
                ["A polite pace", "One visit every few minutes, with a hard limit on visits. It slows down or stops when the store asks."],
                ["Says who it is, and proves it", "Every visit says what it's doing (one customer, at most one item, until a set date) and is signed, so the store can verify it really is Standby."],
                ["Stops on time", "When the deadline passes it stops visiting and releases your hold. You can reactivate it."],
              ].map(([t, b]) => (
                <div key={t} className="rounded-2xl border border-line p-5">
                  <div className="font-semibold">{t}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 rounded-3xl border border-line p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Built to live inside your wallet</h2>
              <p className="mt-2 max-w-2xl text-muted">
                Standby is designed as a feature for a wallet or banking app, next to your balance and payments. This demo runs on the PayPal sandbox and two practice
                stores, so you can watch every decision happen.
              </p>
            </div>
            <Link href="/start?next=/app" className="justify-self-start rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-black">
              Try the demo
            </Link>
          </div>
        </section>

        <section id="safety" className="bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What Standby can never do</h2>
              <p className="mt-3 max-w-md text-white/70">
                These are enforced in code by the Vault, not left to the AI&apos;s judgement. The AIs check meaning. The code checks numbers.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Character who="vault" mood="stern" size={64} />
                <p className="text-sm text-white/70">“I don&apos;t read web pages. I can&apos;t be talked into anything.”</p>
              </div>
            </div>
            <ul className="space-y-3">
              {NEVER.map((n) => (
                <li key={n} className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bad text-xs font-bold">✕</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted">
          <Logo small />
          <span>Hackathon demo · PayPal sandbox · test money only</span>
        </div>
      </footer>
    </div>
  );
}
