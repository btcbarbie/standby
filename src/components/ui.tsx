import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className={small ? "h-6 w-6" : "h-7 w-7"} aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0e1525" />
        <path d="M20.5 9.5a8 8 0 1 0 2 11.6 6.4 6.4 0 0 1-2-11.6Z" fill="#fff" />
        <circle cx="22.5" cy="10.5" r="2.2" fill="#e8930c" />
      </svg>
      <span className={`${small ? "text-base" : "text-lg"} font-semibold tracking-tight`}>Standby</span>
    </span>
  );
}

export function AppHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/app" aria-label="Standby home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export const STATUS: Record<string, { label: string; cls: string }> = {
  SETUP: { label: "Waiting for PayPal", cls: "bg-vault-soft text-vault" },
  WATCHING: { label: "Watching", cls: "bg-brand-soft text-brand" },
  PAUSED: { label: "Paused", cls: "bg-vault-soft text-vault" },
  NEEDS_YOU: { label: "Needs you", cls: "bg-warn-soft text-warn" },
  FOUND: { label: "Found it · your turn", cls: "bg-good-soft text-good" },
  BOUGHT: { label: "Bought", cls: "bg-good-soft text-good" },
  ENDED: { label: "Ended", cls: "bg-vault-soft text-vault" },
};

const PAUSED_LABEL: Record<string, string> = {
  YOU: "Paused",
  DEADLINE: "Paused · time's up",
  VISIT_LIMIT: "Paused · visit limit",
  STORE_CLOSED: "Paused · store closed to AI",
};

export function StatusPill({ status, reason }: { status: string; reason?: string | null }) {
  const base = STATUS[status] ?? STATUS.ENDED;
  const s = status === "PAUSED" && reason ? { ...base, label: PAUSED_LABEL[reason] ?? base.label } : base;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      {status === "WATCHING" && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-brand" />}
      {s.label}
    </span>
  );
}

export const OUTCOME: Record<string, { label: string; cls: string; icon: string }> = {
  SKIPPED: { label: "Skipped", cls: "bg-vault-soft text-vault", icon: "→" },
  BLOCKED: { label: "Blocked", cls: "bg-bad-soft text-bad", icon: "⛔" },
  NEEDS_YOU: { label: "Needs you", cls: "bg-warn-soft text-warn", icon: "✋" },
  BUYING: { label: "Paying…", cls: "bg-brand-soft text-brand", icon: "…" },
  BOUGHT: { label: "Bought", cls: "bg-good-soft text-good", icon: "✓" },
  APPROVED: { label: "You approved · Bought", cls: "bg-good-soft text-good", icon: "✓" },
  FOUND: { label: "Found it", cls: "bg-good-soft text-good", icon: "★" },
  YOU_BOUGHT: { label: "You bought it", cls: "bg-good-soft text-good", icon: "✓" },
  PASSED: { label: "You passed", cls: "bg-vault-soft text-vault", icon: "→" },
  DENIED: { label: "You said no", cls: "bg-vault-soft text-vault", icon: "✕" },
  FAILED: { label: "Payment failed", cls: "bg-bad-soft text-bad", icon: "!" },
};

export function OutcomeStamp({ outcome, big = false }: { outcome: string; big?: boolean }) {
  const o = OUTCOME[outcome] ?? OUTCOME.SKIPPED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${o.cls} ${big ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs"}`}>
      <span aria-hidden>{o.icon}</span>
      {o.label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "danger" | "ghost" | "paypal";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-ink text-white hover:bg-black",
    secondary: "border border-line bg-white text-ink hover:border-ink",
    danger: "border border-bad/30 bg-white text-bad hover:bg-bad-soft",
    ghost: "text-muted hover:text-ink",
    paypal: "bg-[#0070e0] text-white hover:bg-[#005ec2]",
  }[kind];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
