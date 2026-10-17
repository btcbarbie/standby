import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/owner";
import { listingUrl, type StoreKey } from "@/lib/stores";

// /store/tixora and /store/wren open this visitor's own copy of the store.
export default async function StoreHome({ params }: PageProps<"/store/[store]">) {
  const { store } = await params;
  if (store !== "tixora" && store !== "wren") notFound();
  const owner = await requireOwner(`/store/${store}`);
  const listing = await prisma.listing.findFirst({ where: { ownerId: owner.id, store } });
  if (!listing) redirect(`/start?next=/store/${store}`);
  redirect(listingUrl(store as StoreKey, listing.id));
}
