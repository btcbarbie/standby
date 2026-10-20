"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// "← Back" returns to the page you came from on this site: the homepage, your watches, an alert.
// When there's nothing of ours to go back to (a new tab, or arriving from PayPal), it goes to your watches.

let movedInApp = false; // set once you've moved between pages without a full reload

export function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else movedInApp = true;
  }, [pathname]);
  return null;
}

function cameFromHere() {
  try {
    return !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {
    return false;
  }
}

export default function BackLink({ fallback = "/app", label = "← Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      onClick={(e) => {
        e.preventDefault();
        if (movedInApp || cameFromHere()) router.back();
        else router.push(fallback);
      }}
      className="text-sm font-medium text-muted hover:text-ink"
    >
      {label}
    </a>
  );
}

// After PayPal sends you back, the browser's own Back would land on PayPal's finished page.
// This sends that Back to your watches instead.
export function SkipPayPalOnBack() {
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get("via") !== "paypal") return;
    url.searchParams.delete("via");
    history.replaceState(history.state, "", url.pathname + url.search);
    history.pushState(history.state, "", url.pathname + url.search);
    // Kept for the life of this page (not undone on re-render), so the next Back always lands on your watches.
    window.addEventListener("popstate", () => location.replace("/app"), { once: true });
  }, []);
  return null;
}
