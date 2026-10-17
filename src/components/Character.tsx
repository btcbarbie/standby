// The cast. Each character is a real, separate part of the system:
// Scout = the shopping AI, Banker = the blind reviewing AI, Vault = rules in code, You = the owner.

export type Who = "scout" | "banker" | "vault" | "you";
export type Mood = "calm" | "happy" | "alert" | "stern" | "thinking";

export const CAST: Record<Who, { name: string; role: string; color: string; soft: string }> = {
  scout: { name: "Scout", role: "Watches the page and finds the match", color: "#E8930C", soft: "#FDF1DC" },
  banker: { name: "Banker", role: "Checks it again, without seeing Scout's notes", color: "#0F7B5F", soft: "#DDF2EA" },
  vault: { name: "Vault", role: "Hard limits in code. Can't be talked round", color: "#4B5565", soft: "#E8EAEE" },
  you: { name: "You", role: "Decide whenever the checks disagree", color: "#1F4FD8", soft: "#E1E9FD" },
};

function Eyes({ mood, y = 48, gap = 15, dark = "#14181F" }: { mood: Mood; y?: number; gap?: number; dark?: string }) {
  const r = mood === "alert" ? 10 : 8.5;
  const dx = mood === "thinking" ? 2.5 : 0;
  const dy = mood === "thinking" ? -2.5 : mood === "happy" ? -1 : 0;
  const pupil = mood === "alert" ? 3.6 : 4.2;
  return (
    <g>
      {[50 - gap, 50 + gap].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={r - 1} ry={r} fill="#fff" />
          <circle cx={x + dx} cy={y + dy} r={pupil} fill={dark} />
          <circle cx={x + dx + 1.4} cy={y + dy - 1.6} r={1.2} fill="#fff" />
        </g>
      ))}
      {mood === "stern" && (
        <g stroke={dark} strokeWidth="3" strokeLinecap="round">
          <line x1={50 - gap - 8} y1={y - 13} x2={50 - gap + 6} y2={y - 9} />
          <line x1={50 + gap + 8} y1={y - 13} x2={50 + gap - 6} y2={y - 9} />
        </g>
      )}
      {mood === "alert" && (
        <g stroke={dark} strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d={`M${50 - gap - 7} ${y - 15} q7 -5 14 0`} />
          <path d={`M${50 + gap - 7} ${y - 15} q7 -5 14 0`} />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood, y = 70, dark = "#14181F" }: { mood: Mood; y?: number; dark?: string }) {
  if (mood === "happy") return <path d={`M38 ${y - 2} q12 12 24 0`} stroke={dark} strokeWidth="3.4" strokeLinecap="round" fill="none" />;
  if (mood === "alert") return <ellipse cx="50" cy={y} rx="4.5" ry="5.5" fill={dark} />;
  if (mood === "stern") return <line x1="41" y1={y} x2="59" y2={y} stroke={dark} strokeWidth="3.4" strokeLinecap="round" />;
  if (mood === "thinking") return <path d={`M42 ${y} q6 -3 14 1`} stroke={dark} strokeWidth="3.2" strokeLinecap="round" fill="none" />;
  return <path d={`M42 ${y - 1} q8 6 16 0`} stroke={dark} strokeWidth="3.2" strokeLinecap="round" fill="none" />;
}

export default function Character({ who, mood = "calm", size = 64, className = "" }: { who: Who; mood?: Mood; size?: number; className?: string }) {
  const c = CAST[who].color;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={`${CAST[who].name}, ${mood}`}>
      {who === "scout" && (
        <g>
          <circle cx="50" cy="56" r="38" fill={c} />
          {/* explorer cap */}
          <path d="M18 40 C22 16 78 16 82 40 Z" fill="#B96F05" />
          <path d="M60 38 L94 36 C92 42 84 44 72 43 Z" fill="#B96F05" />
          <circle cx="50" cy="22" r="3.5" fill="#FDF1DC" />
          <Eyes mood={mood} y={54} />
          <Mouth mood={mood} y={74} />
          <ellipse cx="27" cy="66" rx="5" ry="3" fill="#fff" opacity="0.25" />
          <ellipse cx="73" cy="66" rx="5" ry="3" fill="#fff" opacity="0.25" />
        </g>
      )}
      {who === "banker" && (
        <g>
          <rect x="12" y="14" width="76" height="76" rx="26" fill={c} />
          <Eyes mood={mood} y={46} />
          {/* round glasses */}
          <g stroke="#0A3A2D" strokeWidth="3" fill="none">
            <circle cx="35" cy="46" r="12" />
            <circle cx="65" cy="46" r="12" />
            <line x1="47" y1="45" x2="53" y2="45" />
          </g>
          <Mouth mood={mood} y={68} />
          {/* bow tie */}
          <path d="M38 88 L50 82 L62 88 L62 96 L50 90 L38 96 Z" fill="#0A3A2D" />
          <circle cx="50" cy="89" r="3" fill="#0A3A2D" />
        </g>
      )}
      {who === "vault" && (
        <g>
          <rect x="10" y="12" width="80" height="80" rx="12" fill={c} />
          <rect x="18" y="20" width="64" height="64" rx="8" fill="#5D6879" />
          {[
            [16, 18],
            [84, 18],
            [16, 86],
            [84, 86],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#2F3744" />
          ))}
          <Eyes mood={mood} y={42} gap={14} />
          {/* combination dial instead of a mouth */}
          <circle cx="50" cy="68" r="10" fill="#2F3744" />
          <circle cx="50" cy="68" r="6.5" fill="#8C96A6" />
          <line x1="50" y1="68" x2={mood === "happy" ? 55 : mood === "stern" || mood === "alert" ? 45 : 50} y2="62" stroke="#2F3744" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="88" y="44" width="5" height="18" rx="2" fill="#2F3744" />
        </g>
      )}
      {who === "you" && (
        <g>
          <circle cx="50" cy="50" r="44" fill={CAST.you.soft} />
          <circle cx="50" cy="40" r="15" fill={c} />
          <path d="M22 82 C26 62 74 62 78 82 C70 90 30 90 22 82 Z" fill={c} />
        </g>
      )}
    </svg>
  );
}
