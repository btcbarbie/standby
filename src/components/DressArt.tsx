export default function DressArt({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 200" className={className} aria-hidden>
      <path d="M48 8 C52 14 68 14 72 8 L80 12 L76 40 C74 52 70 60 70 64 L60 70 L50 64 C50 60 46 52 44 40 L40 12 Z" fill={color} />
      <path d="M50 64 L70 64 L96 188 C80 194 40 194 24 188 Z" fill={color} />
      <path d="M50 64 L70 64 L60 72 Z" fill="#000" opacity="0.15" />
      <path d="M60 70 L46 186" stroke="#000" strokeOpacity="0.18" strokeWidth="2" fill="none" />
      <path d="M70 64 C78 70 86 70 92 66" stroke="#000" strokeOpacity="0.2" strokeWidth="2" fill="none" />
    </svg>
  );
}
