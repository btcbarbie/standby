import type { PageData } from "./page";

// The page read while drafting is reused when the watch starts, so starting a watch costs the store no extra visit.
const cache = new Map<string, { at: number; page: PageData }>();

export function rememberDraft(ownerId: string, page: PageData) {
  cache.set(`${ownerId}|${page.url}`, { at: Date.now(), page });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
}

export function recallDraft(ownerId: string, url: string): PageData | null {
  const hit = cache.get(`${ownerId}|${url}`);
  return hit && Date.now() - hit.at < 30 * 60_000 ? hit.page : null;
}
