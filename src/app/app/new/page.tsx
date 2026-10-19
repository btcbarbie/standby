import { headers } from "next/headers";
import { requireOwner } from "@/lib/owner";
import { loadState } from "@/lib/state";
import NewWatch from "@/components/NewWatch";

export const dynamic = "force-dynamic";

export default async function NewWatchPage({ searchParams }: PageProps<"/app/new">) {
  const { try: preset, url: pasted } = await searchParams;
  // A link pasted into Scout's browser on the homepage survives the first-visit setup.
  const owner = await requireOwner(typeof pasted === "string" ? `/app/new?url=${encodeURIComponent(pasted)}` : "/app/new");
  const state = await loadState(owner.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3300";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <NewWatch stores={state.stores} paypalReady={state.paypalReady} preset={typeof preset === "string" ? preset : null} pastedUrl={typeof pasted === "string" ? pasted.slice(0, 2000) : null} origin={process.env.APP_URL ?? `${proto}://${host}`} />;
}
