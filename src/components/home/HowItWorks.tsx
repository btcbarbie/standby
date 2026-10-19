import { SectionHeading } from "./shared";

const STEPS = [
  {
    title: "Set your intent",
    body: "Paste the link to one product or event and say what you want in plain words. Scout tells you what it can and can't see on that page, you tick the exact option, and you set a ceiling.",
  },
  {
    title: "Monitor and verify",
    body: "Scout revisits that one page at a polite pace. When something new appears, Scout and the Banker judge it separately and the Vault checks the numbers in code.",
  },
  {
    title: "Buy or alert",
    body: "You choose per watch. Alert me: Standby tells you and you pay. Buy it for me: you approve a PayPal hold up front, and Standby takes only the actual price, once, when every check passes.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20">
      <SectionHeading id="how-title" eyebrow="How it works" title="Three steps, one ceiling" />
      <ol className="mt-10 grid gap-4 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line p-6">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden>
              {i + 1}
            </span>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-bg p-5">
          <h3 className="text-sm font-semibold">Alert me, I&apos;ll pay</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Nothing is held and Standby never pays. Works on any store page with readable product data.</p>
        </div>
        <div className="rounded-2xl bg-bg p-5">
          <h3 className="text-sm font-semibold">Buy it for me</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Only where the store accepts AI buyers (here, the demo stores). PayPal holds your ceiling; the hold is released if nothing matches in time.
          </p>
        </div>
      </div>
    </section>
  );
}
