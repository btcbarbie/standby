import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

// No sign-in in the demo: each browser gets its own owner, its own watches and its own copy of the stores.
export const OWNER_COOKIE = "sb_owner";

export async function currentOwner() {
  const id = (await cookies()).get(OWNER_COOKIE)?.value;
  if (!id) return null;
  return prisma.owner.findUnique({ where: { id } });
}

export async function requireOwner(next: string) {
  const owner = await currentOwner();
  if (!owner) redirect(`/start?next=${encodeURIComponent(next)}`);
  return owner;
}
