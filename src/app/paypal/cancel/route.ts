import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("watch") ?? "";
  const m = await prisma.mandate.findUnique({ where: { id } });
  if (m && m.status === "SETUP") {
    await prisma.mandate.update({ where: { id }, data: { lastNote: "You cancelled the PayPal step. Nothing is held." } });
  }
  return new NextResponse(null, { status: 307, headers: { Location: m ? `/app/w/${id}` : "/app" } });
}
