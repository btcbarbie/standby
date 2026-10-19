import Link from "next/link";
import { Logo } from "@/components/ui";
import { DEMO_HREF } from "./shared";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#safety", label: "Safety" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Standby home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <Link href={DEMO_HREF} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black">
            Try the demo
          </Link>
          {/* Phones: a native disclosure menu, so it works with keyboard and screen readers without extra code. */}
          <details className="relative sm:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-line [&::-webkit-details-marker]:hidden" aria-label="More links">
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </summary>
            <ul className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-lg">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-bg">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>
      </div>
    </header>
  );
}
