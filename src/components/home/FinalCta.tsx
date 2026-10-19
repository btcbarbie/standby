import Link from "next/link";
import Character from "@/components/Character";
import { Logo } from "@/components/ui";
import { DEMO_HREF } from "./shared";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 py-20">
      <div className="grid gap-8 rounded-3xl border border-line p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex -space-x-2" aria-hidden>
            <Character who="scout" mood="happy" size={44} />
            <Character who="banker" mood="calm" size={44} />
            <Character who="vault" mood="calm" size={44} />
          </div>
          <h2 id="cta-title" className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Set up a watch in under a minute
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            The demo gives you your own copy of two practice stores. List tickets, restock sizes, plant a trick, and watch the team decide.
          </p>
        </div>
        <Link href={DEMO_HREF} className="justify-self-start rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-black">
          Try the demo
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Logo small />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#safety" className="hover:text-ink">
                Safety
              </a>
            </li>
            <li>
              <Link href={DEMO_HREF} className="hover:text-ink">
                Try the demo
              </Link>
            </li>
          </ul>
        </nav>
        <p className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-[#0070e0]" aria-hidden />
          PayPal sandbox · test money only · hackathon demo
        </p>
      </div>
    </footer>
  );
}
