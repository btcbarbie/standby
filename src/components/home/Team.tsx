import Character, { CAST, type Who } from "@/components/Character";
import { SectionHeading } from "./shared";

export default function Team({ scoutMaker }: { scoutMaker: string }) {
  const twoCompanies = scoutMaker !== "Anthropic Claude";
  const members: { who: Who; tag: string; role: string; detail: string }[] = [
    {
      who: "scout",
      tag: `AI · ${scoutMaker}`,
      role: "Watches your one page and spots a match.",
      detail: "It can only propose. It has no way to pay.",
    },
    {
      who: "banker",
      tag: "AI · Anthropic Claude",
      role: "Reviews every match without seeing Scout's answer.",
      detail: twoCompanies ? "A different company's AI, so the two don't share blind spots. It can't pay either." : "It flags tricks and mismatches. It can't pay either.",
    },
    {
      who: "vault",
      tag: "Code, not AI",
      role: "Holds the hard limits: item, price, quantity, timing.",
      detail: "It doesn't read web pages, so it can't be talked round.",
    },
    {
      who: "you",
      tag: "The final say",
      role: "Set the order and approve the PayPal hold once.",
      detail: "Anything the checks disagree on comes to you.",
    },
  ];

  return (
    <section aria-labelledby="team-title" className="border-y border-line bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          id="team-title"
          eyebrow="Meet your shopping team"
          title="Two AIs, one rulebook, and you"
          intro="No single AI can spend your money. Money moves only when Scout and the Banker agree and every Vault limit passes."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((m) => (
            <li key={m.who} className="flex flex-col rounded-2xl border border-line bg-white p-5">
              <Character who={m.who} mood={m.who === "scout" ? "happy" : "calm"} size={64} />
              <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-lg font-semibold" style={{ color: CAST[m.who].color }}>
                  {CAST[m.who].name}
                </h3>
                <span className="text-xs font-medium text-muted">{m.tag}</span>
              </div>
              <p className="mt-2 text-[15px] font-medium leading-snug">{m.role}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{m.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
