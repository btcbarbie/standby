import { requireOwner } from "@/lib/owner";
import { loadState } from "@/lib/state";
import Home from "@/components/Home";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const owner = await requireOwner("/app");
  const state = await loadState(owner.id);
  return <Home initial={state} />;
}
