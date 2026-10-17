import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// The public address of this app, for links PayPal sends the owner back to.
// Never built from req.url: behind a proxy that points at the internal host.
export function publicOrigin(req: NextRequest) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3300";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// In this demo the agents may only watch the two demo stores (never arbitrary URLs).
export function storePath(input: string): string | null {
  let path = input.trim();
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
  } catch {
    return null;
  }
  return /^\/store\/(tixora\/e|wren\/p)\/[a-z0-9]+$/i.test(path) ? path : null;
}
