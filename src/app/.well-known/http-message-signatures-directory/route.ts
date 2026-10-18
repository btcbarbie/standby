import { NextResponse } from "next/server";
import { publicJwk } from "@/lib/agentKey";

// Standby's public key directory (Web Bot Auth). Stores use it to check that a visit really came from Standby.
export async function GET() {
  return NextResponse.json(
    { keys: [await publicJwk()], purpose: "Standby shopping agents: one page, one customer, polite pace." },
    { headers: { "Content-Type": "application/http-message-signatures-directory+json", "Cache-Control": "max-age=300" } },
  );
}
