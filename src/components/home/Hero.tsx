import Link from "next/link";
import DecisionPreview from "./DecisionPreview";
import { DEMO_HREF } from "./shared";

export default function Hero({ twoCompanies }: { twoCompanies: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-scout-soft px-3 py-1 text-xs font-semibold text-[#8a5300]">
          <span className="h-1.5 w-1.5 rounded-full bg-scout" aria-hidden /> AI that shops for you, with guardrails
        </p>
        <h1 id="hero-title" className="mt-5 text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]">
          Say exactly what you want. <span className="text-muted">It waits.</span> Two checks decide.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Tell Standby the one thing you want and your ceiling. An AI watches that page while you&apos;re away. A second AI{twoCompanies ? " from a different company" : ""}{" "}
          reviews every match without seeing the first one&apos;s answer, and limits written in code decide whether money can move.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={DEMO_HREF} className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black">
            Try the demo
          </Link>
          <a href="#how" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold transition-colors hover:border-ink">
            How it works
          </a>
        </div>
        <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-muted">
          <span className="rounded bg-[#0070e0] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Sandbox</span>
          Runs on the PayPal sandbox with test money. No real payments.
        </p>
      </div>
      <DecisionPreview />
    </section>
  );
}
