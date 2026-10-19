import Link from "next/link";
import Character, { CAST, type Who } from "@/components/Character";
import { Logo } from "@/components/ui";
import { scoutProvider } from "@/lib/ai";
import StoryBoard from "@/components/StoryBoard";

export const dynamic = "force-dynamic";

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
              <span className="h-1.5 w-1.5 rounded-full bg-scout" /> AI that buys for you, with a second opinion
            </p>
            <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl">
              Say exactly what you want.
              <br className="hidden sm:block" /> <span className="text-muted">It waits.</span> Two checks decide.
            </h1>
          </div>
          <div className="mt-10">
            <StoryBoard scoutMaker={twoCompanies ? "Gemini" : "Claude"} />
          </div>
        </section>

        <section className="border-y border-line bg-bg">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meet the team on your account</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Each one is a separate part of the system with one job. No single AI can spend your money on its own say-so.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["scout", "banker", "vault", "you"] as Who[]).map((who) => (
                <div key={who} className="rounded-2xl border border-line bg-white p-5">
                  <Character who={who} mood={who === "scout" ? "happy" : "calm"} size={72} />
                  <div className="mt-4 text-lg font-semibold" style={{ color: CAST[who].color }}>
                    {CAST[who].name}
                  </div>
                  <p className="mt-1 text-sm text-muted">{CAST[who].role}.</p>
                  <p className="mt-3 text-xs font-medium text-ink/70">
                    {
                      {
                        scout: `An AI (${twoCompanies ? "Google Gemini" : "Anthropic Claude"}). Reads the page, proposes a purchase. Can't pay.`,
                        banker: twoCompanies
                          ? "A second AI from a different company (Anthropic Claude). Reviews blind, flags tricks. Can't pay."
                          : "A second AI (Anthropic Claude). Reviews blind, flags tricks. Can't pay.",
                        vault: "Not an AI. Plain rules: item, seller, price, quantity, speed.",
                        you: "Approve the PayPal hold once. Break any tie.",
                      }[who]
                    }
                  </p>
                </div>
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
