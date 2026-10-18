import { lookup } from "dns/promises";
import { isIP } from "net";

// Reading real websites safely: public HTTPS addresses only (never this server's own network),
// a few checked redirects, a size cap, and the site's robots.txt rules respected.

const MAX_BYTES = 4_000_000;
const TIMEOUT_MS = 15_000;

export class SiteError extends Error {}

// The site's robots.txt says automated agents shouldn't visit this page.
export class RobotsBlocked extends SiteError {}

function privateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:") || v === "::";
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SiteError("That doesn't look like a web address.");
  }
  if (url.protocol !== "https:") throw new SiteError("Only https:// links can be watched.");
  if (url.port && url.port !== "443") throw new SiteError("That address uses an unusual port.");
  if (url.username || url.password) throw new SiteError("Links with passwords in them can't be watched.");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || isIP(host)) throw new SiteError("Only public websites can be watched.");
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new SiteError("That website couldn't be found.");
  if (addrs.some((a) => privateAddress(a.address))) throw new SiteError("Only public websites can be watched.");
  return url;
}

export async function fetchPublic(raw: string, headers: Record<string, string>): Promise<{ status: number; url: string; text: string; retryAfter: string | null }> {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, { headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    return { status: res.status, url: url.toString(), text, retryAfter: res.headers.get("retry-after") };
  }
  throw new SiteError("That page redirects too many times.");
}

// ---------- robots.txt: the site's own rules for automated visitors ----------

type Rule = { allow: boolean; path: string };
const robotsCache = new Map<string, { at: number; groups: { agents: string[]; rules: Rule[] }[] }>();

function parseRobots(txt: string) {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function ruleMatches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

// Follows the robots.txt standard (RFC 9309): our own group if named, otherwise "*"; the longest matching rule wins.
export async function robotsAllows(raw: string, agentToken = "standbyagent"): Promise<boolean> {
  const url = new URL(raw);
  const key = url.origin;
  let entry = robotsCache.get(key);
  if (!entry || Date.now() - entry.at > 3_600_000) {
    try {
      const res = await fetchPublic(`${url.origin}/robots.txt`, { "User-Agent": "StandbyAgent/1.0 (one page, one customer)" });
      entry = { at: Date.now(), groups: res.status === 200 ? parseRobots(res.text) : [] };
    } catch {
      entry = { at: Date.now(), groups: [] };
    }
    robotsCache.set(key, entry);
  }
  const ours = entry.groups.filter((g) => g.agents.some((a) => a !== "*" && agentToken.includes(a)));
  const groups = ours.length ? ours : entry.groups.filter((g) => g.agents.includes("*"));
  const rules = groups.flatMap((g) => g.rules);
  const path = url.pathname + url.search;
  let best: Rule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}
