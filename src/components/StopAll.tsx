"use client";

import { useState } from "react";

export default function StopAll({ stopped, onChange }: { stopped: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!stopped && !confirm("Stop all agents? Nothing will be bought until you switch them back on.")) return;
    setBusy(true);
    await fetch("/api/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stopped: !stopped }) });
    setBusy(false);
    onChange();
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
        stopped ? "bg-good text-white hover:opacity-90" : "border border-bad/30 bg-white text-bad hover:bg-bad-soft"
      }`}
    >
      {stopped ? "Switch agents back on" : "Stop all"}
    </button>
  );
}
