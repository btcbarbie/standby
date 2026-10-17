import { notFound } from "next/navigation";
import { loadListing, jsonLd, ticketDetails } from "@/lib/listing";
import { money, shortDate } from "@/lib/format";
import { currentOwner } from "@/lib/owner";
import DemoControls from "@/components/DemoControls";

export const dynamic = "force-dynamic";

export default async function TixoraEvent({ params }: PageProps<"/store/tixora/e/[id]">) {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing || listing.store !== "tixora") notFound();
  const d = ticketDetails(listing);
  const owner = await currentOwner();
  const isMine = owner?.id === listing.ownerId;
  const available = listing.offers.filter((o) => o.stock > 0);

  const wingOf = (section: string) => {
    const n = parseInt(section, 10);
    return n <= 108 ? "left" : n <= 116 ? "centre" : "right";
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] text-white" style={{ fontFamily: "var(--font-sans)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(listing)) }} />
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[#c6f432] text-sm font-black text-black">T</span>
            tixora
          </div>
          <nav className="hidden gap-6 text-sm text-white/60 sm:flex">
            <span>Concerts</span>
            <span>Sport</span>
            <span>Theatre</span>
            <span>Sell tickets</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-40 pt-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#c6f432]">Resale · Verified tickets</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{listing.name}</h1>
        <p className="mt-2 text-white/70">
          {d.venue}, {d.city} · {shortDate(d.date)} · {d.doors}
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white/80">Venue map</h2>
            <svg viewBox="0 0 300 190" className="mt-3 w-full" aria-label="Seating map">
              <rect x="95" y="10" width="110" height="24" rx="4" fill="#2a2a35" />
              <text x="150" y="26" textAnchor="middle" fontSize="10" fill="#aaa">STAGE</text>
              <path d="M20 60 L95 45 L95 175 L20 160 Z" fill="#7c5cff" opacity="0.85" />
              <rect x="105" y="45" width="90" height="130" rx="6" fill="#3b3b4a" />
              <path d="M280 60 L205 45 L205 175 L280 160 Z" fill="#ff7a59" opacity="0.85" />
              <text x="57" y="115" textAnchor="middle" fontSize="10" fill="#fff">101–108</text>
              <text x="150" y="115" textAnchor="middle" fontSize="10" fill="#ddd">109–116</text>
              <text x="243" y="115" textAnchor="middle" fontSize="10" fill="#fff">117–124</text>
            </svg>
            <ul className="mt-3 space-y-1 text-sm text-white/70">
              {d.mapLegend.map((l) => (
                <li key={l.wing}>
                  <span className="font-medium text-white">{l.wing}:</span> {l.sections}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{available.length} tickets listed</h2>
              <span className="text-xs text-white/50">Prices per ticket. A service fee is added at checkout.</span>
            </div>
            <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
              {available.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: { left: "#7c5cff", centre: "#8a8a9a", right: "#ff7a59" }[wingOf(o.attrs.section)] }}
                      />
                      <span className="font-medium">{o.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/50">
                      Sold by {o.seller} · Ref {o.ref}
                    </p>
                    {o.note && <p className="mt-1 text-xs text-white/70">“{o.note}”</p>}
                    {o.hiddenNote && (
                      <p style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>{o.hiddenNote}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-semibold">{money(o.priceCents)}</div>
                    <div className="text-xs text-white/50">+ {money(o.feeCents)} service fee</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      {isMine && <DemoControls store="tixora" />}
    </div>
  );
}
