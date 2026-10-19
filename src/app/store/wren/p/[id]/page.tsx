import { notFound } from "next/navigation";
import { loadListing, jsonLd, dressDetails } from "@/lib/listing";
import { money } from "@/lib/format";
import { currentOwner } from "@/lib/owner";
import StorePanel from "@/components/StorePanel";
import { logAgentVisit } from "@/lib/storeLog";
import DressArt from "@/components/DressArt";

export const dynamic = "force-dynamic";

const SWATCH: Record<string, string> = { Green: "#2f5d4a", Black: "#1d1d1f", Rust: "#a4502c" };

export default async function WrenProduct({ params }: PageProps<"/store/wren/p/[id]">) {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing || listing.store !== "wren") notFound();
  const d = dressDetails(listing);
  await logAgentVisit(listing.id, `/store/wren/p/${listing.id}`);
  const owner = await currentOwner();
  const isMine = owner?.id === listing.ownerId;

  const own = listing.offers.filter((o) => o.seller === "Wren");
  const market = listing.offers.filter((o) => o.seller !== "Wren" && o.stock > 0);
  const stockOf = (color: string, size: string) => own.find((o) => o.attrs.color === color && o.attrs.size === size)?.stock ?? 0;
  const price = own[0]?.priceCents ?? 0;

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#222]" style={{ fontFamily: "var(--font-sans)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(listing)) }} />
      <div className="bg-[#222] py-1.5 text-center text-xs tracking-wide text-white/90">Free returns within 30 days</div>
      <header className="border-b border-black/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <span className="text-2xl tracking-[0.3em]" style={{ fontFamily: "var(--font-display)" }}>
            WREN
          </span>
          <nav className="hidden gap-6 text-sm text-black/60 sm:flex">
            <span>New in</span>
            <span>Dresses</span>
            <span>Knitwear</span>
            <span>Stories</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-40 pt-8 md:grid-cols-2">
        <div className="grid grid-cols-3 gap-3">
          {d.colors.map((c, i) => (
            <div key={c} className={`${i === 0 ? "col-span-3" : ""} grid place-items-center rounded-sm bg-[#efe9df] p-4`}>
              <DressArt color={SWATCH[c]} className={i === 0 ? "h-80" : "h-32"} />
            </div>
          ))}
        </div>

        <section>
          <p className="text-xs uppercase tracking-widest text-black/50">{d.brand}</p>
          <h1 className="mt-1 text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            {listing.name}
          </h1>
          <p className="mt-2 text-xl">{money(price)}</p>
          <p className="mt-1 text-sm text-black/60">{d.shippingNote}</p>
          <p className="mt-1 text-sm text-black/60">Pay with PayPal or card.</p>

          <div className="mt-8 space-y-6">
            {d.colors.map((c) => (
              <div key={c}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: SWATCH[c] }} />
                  <span className="font-medium">{c}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.sizes.map((s) => {
                    const n = stockOf(c, s);
                    const exists = own.some((o) => o.attrs.color === c && o.attrs.size === s);
                    return (
                      <span
                        key={s}
                        className={`min-w-12 rounded-sm border px-3 py-2 text-center text-sm ${
                          n > 0 ? "border-black/70 bg-white" : "border-black/10 text-black/30 line-through"
                        }`}
                      >
                        {s}
                        {exists && n === 0 && <span className="sr-only"> sold out</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <ul className="mt-8 space-y-1 text-sm text-black/70">
            <li>{d.fabric}</li>
            <li>{d.fit}</li>
            <li>Sizes shown crossed out are sold out.</li>
          </ul>

          {market.length > 0 && (
            <div className="mt-10 border-t border-black/10 pt-6">
              <h2 className="text-sm font-semibold">From marketplace sellers</h2>
              <p className="text-xs text-black/50">Sold and shipped by independent sellers, not Wren.</p>
              <ul className="mt-3 space-y-2">
                {market.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-sm border border-black/10 bg-white px-3 py-2 text-sm">
                    <span>
                      {o.label} · {o.seller}
                      {o.note && <span className="block text-xs text-black/50">“{o.note}”</span>}
                    </span>
                    <span>{money(o.priceCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      {isMine && <StorePanel store="wren" listingId={listing.id} />}
    </div>
  );
}
