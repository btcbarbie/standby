import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedStores } from "@/lib/stores";
import { startDemoWatch } from "@/lib/demoWatch";
import { OWNER_COOKIE } from "@/lib/owner";

// Creates this browser's owner and its own copy of the demo stores, then goes where the visitor was heading.
export async function GET(req: NextRequest) {
  const nextPath = req.nextUrl.searchParams.get("next") ?? "/app";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app";

  let ownerId = req.cookies.get(OWNER_COOKIE)?.value;
  const existing = ownerId ? await prisma.owner.findUnique({ where: { id: ownerId } }) : null;
  if (!existing) {
    const owner = await prisma.owner.create({ data: {} });
    ownerId = owner.id;
  }
  await seedStores(ownerId!);
  // First visit: a watch is already running, so the agents can be seen working straight away.
  if (!existing) await startDemoWatch(ownerId!);

  // Relative redirect: behind a proxy, req.url can point at the internal host.
  const res = new NextResponse(null, { status: 307, headers: { Location: safeNext } });
  res.cookies.set(OWNER_COOKIE, ownerId!, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return res;
}
