"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TimeAgo from "./TimeAgo";
import { withTimes } from "./Conversation";
import type { AlertView } from "@/lib/state";

// Important moments, apart from the chat: a buy went through, a find is waiting, the checks need your call,
// a watch paused. A count on the bell until you've seen them, and a notification on this device if you allow it.

export default function AlertBell({ alerts, onSeen }: { alerts: AlertView[]; onSeen: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  useEffect(() => {
    // Read once in the browser; there's no Notification object on the server.
    if (typeof Notification !== "undefined") queueMicrotask(() => setPermission(Notification.permission));
  }, []);

  // Notify about alerts that arrive while the app is open (not the ones already there when it loaded).
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!known.current) {
      known.current = new Set(alerts.map((a) => a.id));
      return;
    }
    for (const a of alerts) {
      if (known.current.has(a.id)) continue;
      known.current.add(a.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(`Standby · ${a.watchTitle}`, { body: withTimes(a.text), tag: a.id });
        n.onclick = () => {
          window.focus();
          router.push(`/app/w/${a.watchId}`);
        };
      }
    }
  }, [alerts, router]);

  async function seen(body: { ids?: string[] }) {
    await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    onSeen();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={alerts.length ? `${alerts.length} new alert${alerts.length > 1 ? "s" : ""}` : "Alerts"}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white hover:border-ink"
      >
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
          <path d="M10 2.5a5 5 0 0 0-5 5v3.2L3.6 13.4a.6.6 0 0 0 .5.9h11.8a.6.6 0 0 0 .5-.9L15 10.7V7.5a5 5 0 0 0-5-5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 16.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {alerts.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">{alerts.length}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[360px] rounded-2xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">Alerts</span>
            {alerts.length > 0 && (
              <button type="button" onClick={() => seen({})} className="text-xs font-semibold text-brand hover:underline">
                Mark all seen
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing new. Buys, finds and questions for you show up here.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      await seen({ ids: [a.id] });
                      router.push(`/app/w/${a.watchId}`);
                    }}
                    className="block w-full px-4 py-3 text-left hover:bg-bg"
                  >
                    <span className="block text-xs font-semibold text-muted">{a.watchTitle}</span>
                    <span className="mt-0.5 block text-sm">{withTimes(a.text)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      <TimeAgo at={a.at} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {permission !== "unsupported" && permission !== "granted" && (
            <div className="border-t border-line bg-bg px-4 py-3 text-xs">
              {permission === "denied" ? (
                <span className="text-muted">Notifications are blocked for this site in your browser settings.</span>
              ) : (
                <button type="button" onClick={async () => setPermission(await Notification.requestPermission())} className="font-semibold text-brand hover:underline">
                  Get alerts on this device too
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
