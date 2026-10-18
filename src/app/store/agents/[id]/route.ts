import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// The store's published rules for AI shopping agents, like robots.txt.
export async function GET(_req: NextRequest, ctx: RouteContext<"/store/agents/[id]">) {
  const { id } = await ctx.params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { agentPolicy: true } });
  const policy = listing?.agentPolicy ?? "WELCOME";
  return NextResponse.json({
    aiAgents: policy === "CLOSED" ? "closed" : policy === "SLOW" ? "slow" : "welcome",
    minSecondsBetweenVisits: policy === "SLOW" ? 60 : 0,
    rules: "Identify yourself. Visit only the page you were sent to.",
  });
}
