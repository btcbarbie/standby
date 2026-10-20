import { AGENT_UA } from "./manners";
import { fetchPublic, robotsAllows } from "./safeFetch";

// Does a real store take checkouts from AI agents? Stores that do publish a Universal Commerce Protocol
// profile at /.well-known/ucp, listing what an agent can do there and which ways to pay it accepts.
// This is information only: real stores stay alert-only in Standby.

export type AiCheckout = {
  supported: boolean;
  checkout: boolean; // the profile offers dev.ucp.shopping.checkout
  payWith: string[]; // friendly names, e.g. "Google Pay", "Card", "Shop Pay"
  paypal: boolean;
};

const HOUR = 3_600_000;
const cache = new Map<string, { at: number; profile: Promise<AiCheckout | null> }>();

export function aiCheckoutFor(pageUrl: string): Promise<AiCheckout | null> {
  let host: string;
  try {
    host = new URL(pageUrl).host;
  } catch {
    return Promise.resolve(null);
  }
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < HOUR) return hit.profile;
  const profile = readProfile(`https://${host}/.well-known/ucp`).catch(() => null);
  cache.set(host, { at: Date.now(), profile });
  return profile;
}

async function readProfile(url: string): Promise<AiCheckout | null> {
  if (!(await robotsAllows(url))) return null;
  const res = await fetchPublic(url, { "User-Agent": AGENT_UA, Accept: "application/json" }, { timeoutMs: 4_000, maxBytes: 512_000 });
  if (res.status !== 200) return null;
  const ucp = (JSON.parse(res.text) as { ucp?: Record<string, unknown> })?.ucp;
  if (!ucp || typeof ucp !== "object") return null;
  const capabilities = keysOf(ucp.capabilities);
  const handlers = keysOf(ucp.payment_handlers);
  const payWith = [...new Set(handlers.map(friendlyName))];
  return {
    supported: keysOf(ucp.services).length > 0 || capabilities.length > 0,
    checkout: capabilities.includes("dev.ucp.shopping.checkout"),
    payWith,
    paypal: payWith.includes("PayPal"),
  };
}

// Profiles list things as an object keyed by name; older ones may use a list of { name }.
function keysOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : (x as { name?: unknown })?.name)).filter((x): x is string => typeof x === "string");
  return v && typeof v === "object" ? Object.keys(v) : [];
}

function friendlyName(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("paypal")) return "PayPal";
  if (k.includes("google.pay") || k.includes("google_pay")) return "Google Pay";
  if (k.includes("apple.pay") || k.includes("apple_pay")) return "Apple Pay";
  if (k.includes("shop_pay")) return "Shop Pay";
  if (k.endsWith(".card") || k.endsWith("_card")) return "Card";
  const last = key.split(".").pop() ?? key;
  return last.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
