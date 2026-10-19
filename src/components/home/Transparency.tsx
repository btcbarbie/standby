import { SectionHeading } from "./shared";

const ITEMS = [
  {
    title: "One page, nothing else",
    body: "Scout visits only the link you gave it, at a fixed pace with a visit limit, signs every visit (Web Bot Auth) and never touches a store's checkout. It stops at your deadline.",
  },
  {
    title: "Limits enforced in code",
    body: "The option you ticked, allowed listings, seller, quantity, total with fees, the PayPal hold, one purchase per watch, speed and daily caps. Tested with both AIs assumed compromised.",
  },
  {
    title: "Where it can buy",
    body: "Automatic purchases need a store that accepts AI buyers, like the demo stores here. On other real stores Standby watches and alerts, and you check out yourself.",
  },
  {
    title: "What it can't see",
    body: "Shipping and tax often appear only at checkout, so on real stores the limit covers the price shown. Pages without readable product data can't be locked onto, and Standby says so when you set up.",
  },
];

export default function Transparency() {
  return (
    <section aria-labelledby="limits-title" className="border-t border-line bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading id="limits-title" eyebrow="Transparency" title="What it does, and where it stops" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {ITEMS.map((i) => (
            <li key={i.title} className="rounded-2xl border border-line bg-white p-6">
              <h3 className="font-semibold">{i.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{i.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
