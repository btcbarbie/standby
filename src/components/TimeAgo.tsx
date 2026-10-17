"use client";

import { useSyncExternalStore } from "react";
import { ago } from "@/lib/format";

// Relative times ("12s ago") are drawn only in the browser, so the server's render never disagrees with it.
function subscribe(cb: () => void) {
  const t = setInterval(cb, 5000);
  return () => clearInterval(t);
}
const tick = () => Math.floor(Date.now() / 5000);

export default function TimeAgo({ at, prefix = "" }: { at: string | null | undefined; prefix?: string }) {
  const now = useSyncExternalStore(subscribe, tick, () => null);
  if (now === null) return null;
  return (
    <>
      {prefix}
      {ago(at)}
    </>
  );
}
