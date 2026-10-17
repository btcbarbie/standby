"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppState } from "./state";

// The screens refresh themselves every few seconds, so you see the agents work without reloading.
export function usePoll(initial: AppState, watchId?: string, everyMs = 2500) {
  const [state, setState] = useState(initial);
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/state${watchId ? `?watch=${watchId}` : ""}`, { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, [watchId]);
  useEffect(() => {
    const t = setInterval(refresh, everyMs);
    return () => clearInterval(t);
  }, [refresh, everyMs]);
  return { state, refresh };
}
