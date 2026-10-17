import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner";
import { loadState } from "@/lib/state";
import WatchView from "@/components/WatchView";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: PageProps<"/app/w/[id]">) {
  const { id } = await params;
  const owner = await requireOwner(`/app/w/${id}`);
  const state = await loadState(owner.id, id);
  if (!state.detail) notFound();
  return <WatchView id={id} initial={state} />;
}
