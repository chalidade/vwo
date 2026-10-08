// Booth mascots: small round creatures in a monster-collector style, each wearing the company's
// colour as a scarf and its logo as a badge. Original designs, not any game's characters.

const INK = "#2b1e19";
const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export const MASCOT_KINDS = [
  { id: "bolo", name: "Bolo", about: "Bola listrik berkuping runcing" },
  { id: "kitsu", name: "Kitsu", about: "Rubah api berekor lebat" },
  { id: "piyo", name: "Piyo", about: "Anak burung yang suka menyapa" },
  { id: "tunas", name: "Tunas", about: "Kodok daun yang kalem" },
  { id: "momo", name: "Momo", about: "Beruang awan yang empuk" },
] as const;
export type MascotKind = (typeof MASCOT_KINDS)[number]["id"];

/** The default mascot for a booth when the company has not picked one. */
export function mascotFor(seed: string): MascotKind {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MASCOT_KINDS[h % MASCOT_KINDS.length]!.id;
}

function Eyes({ y = 25, gap = 7, cx = 24 }: { y?: number; gap?: number; cx?: number }) {
  return (
    <g className="jb-blink">
      {[-gap, gap].map((d) => (
        <g key={d}>
          <ellipse cx={cx + d} cy={y} rx={2.6} ry={3.4} fill={INK} />
          <circle cx={cx + d + 0.9} cy={y - 1.3} r={1} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function Cheeks({ y = 29, gap = 11, color = "#fb7185" }: { y?: number; gap?: number; color?: string }) {
  return (
    <>
      <ellipse cx={24 - gap} cy={y} rx={2.6} ry={1.7} fill={color} opacity={0.85} />
      <ellipse cx={24 + gap} cy={y} rx={2.6} ry={1.7} fill={color} opacity={0.85} />
    </>
  );
}

const Smile = ({ y = 30 }: { y?: number }) => <path d={`M21.5 ${y}q2.5 2.4 5 0`} fill="none" {...ink} strokeWidth={1.5} />;

/** Scarf in the company's colour with its logo on a round badge. */
function Scarf({ color, logo, y = 36 }: { color: string; logo: string; y?: number }) {
  return (
    <>
      <path d={`M13 ${y}q11 5 22 0l-1 4q-10 4-20 0Z`} fill={color} {...ink} strokeWidth={1.5} />
      <path d={`M30 ${y + 3}l3 7-4-1Z`} fill={color} {...ink} strokeWidth={1.4} />
      <circle cx={24} cy={y + 8} r={4.6} fill="#fff" {...ink} strokeWidth={1.4} />
      <text x={24} y={y + 10} textAnchor="middle" fontSize={5} fontWeight={900} fill={color} fontFamily="system-ui, sans-serif">
        {logo.slice(0, 2)}
      </text>
    </>
  );
}

function Bolo({ color, logo }: { color: string; logo: string }) {
  return (
    <>
      <path d="M14 18L8 3l12 9Z" fill="#facc15" {...ink} />
      <path d="M9.6 7L8 3l4 3Z" fill={INK} />
      <path d="M34 18l6-15-12 9Z" fill="#facc15" {...ink} />
      <path d="M38.4 7L40 3l-4 3Z" fill={INK} />
      <path d="M38 40l7-4-3 6 5 0-8 7" fill="#facc15" {...ink} strokeWidth={1.6} />
      <ellipse cx={24} cy={33} rx={15} ry={16} fill="#facc15" {...ink} />
      <Eyes />
      <Cheeks color="#ef4444" />
      <Smile />
      <Scarf color={color} logo={logo} />
      <ellipse cx={17} cy={49} rx={4} ry={2.4} fill="#facc15" {...ink} strokeWidth={1.6} />
      <ellipse cx={31} cy={49} rx={4} ry={2.4} fill="#facc15" {...ink} strokeWidth={1.6} />
    </>
  );
}

function Kitsu({ color, logo }: { color: string; logo: string }) {
  return (
    <>
      <path d="M33 44q14-2 12-16-2-6-6-4 2 10-8 14Z" fill="#fb923c" {...ink} />
      <path d="M43 26q2 2 1.6 5l-3-2Z" fill="#fff7ed" stroke="none" />
      <path d="M13 20L10 6l11 8Z" fill="#fb923c" {...ink} />
      <path d="M35 20l3-14-11 8Z" fill="#fb923c" {...ink} />
      <path d="M12.5 12l-1-4 4 3Z M35.5 12l1-4-4 3Z" fill="#fde68a" stroke="none" />
      <ellipse cx={24} cy={33} rx={14} ry={15.5} fill="#fb923c" {...ink} />
      <path d="M14 30q10 12 20 0q-2 10-10 10t-10-10Z" fill="#fff7ed" stroke="none" />
      <Eyes y={26} />
      <ellipse cx={24} cy={30.5} rx={1.6} ry={1.1} fill={INK} />
      <Cheeks y={30} gap={10.5} />
      <Scarf color={color} logo={logo} y={37} />
      <ellipse cx={17.5} cy={49} rx={3.6} ry={2.3} fill="#7c2d12" {...ink} strokeWidth={1.5} />
      <ellipse cx={30.5} cy={49} rx={3.6} ry={2.3} fill="#7c2d12" {...ink} strokeWidth={1.5} />
    </>
  );
}

function Piyo({ color, logo }: { color: string; logo: string }) {
  return (
    <>
      <path d="M22 9q2-7 6-5-3 2-2 6" fill="#fde047" {...ink} strokeWidth={1.6} />
      <ellipse cx={24} cy={30} rx={15} ry={18} fill="#fde047" {...ink} />
      <path className="jb-flap" d="M38 30q9-6 8 4-3 4-8 2Z" fill="#facc15" {...ink} strokeWidth={1.6} />
      <path d="M10 30q-8-3-6 5 3 3 6 1Z" fill="#facc15" {...ink} strokeWidth={1.6} />
      <Eyes y={23} gap={6.5} />
      <path d="M21 27l3 4 3-4Z" fill="#f97316" {...ink} strokeWidth={1.4} />
      <Cheeks y={28} gap={10.5} />
      <Scarf color={color} logo={logo} y={36} />
      <path d="M18 47l-2 4h5M30 47l2 4h-5" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Tunas({ color, logo }: { color: string; logo: string }) {
  return (
    <>
      <path d="M24 14q-3-10 4-12 4 6-4 12Z" fill="#22c55e" {...ink} strokeWidth={1.6} />
      <path d="M24 14q-8-6-12-2 4 6 12 2Z" fill="#4ade80" {...ink} strokeWidth={1.6} />
      <ellipse cx={24} cy={34} rx={17} ry={14} fill="#5eead4" {...ink} />
      <circle cx={15} cy={21} r={5.5} fill="#5eead4" {...ink} />
      <circle cx={33} cy={21} r={5.5} fill="#5eead4" {...ink} />
      <ellipse cx={14} cy={42} rx={3} ry={2} fill="#2dd4bf" stroke="none" />
      <ellipse cx={34} cy={38} rx={2.4} ry={1.6} fill="#2dd4bf" stroke="none" />
      <Eyes y={22} gap={9} />
      <path d="M17 29q7 5 14 0" fill="none" {...ink} strokeWidth={1.5} />
      <Cheeks y={28} gap={13} />
      <Scarf color={color} logo={logo} y={35} />
      <ellipse cx={15} cy={48.5} rx={4.4} ry={2.4} fill="#5eead4" {...ink} strokeWidth={1.5} />
      <ellipse cx={33} cy={48.5} rx={4.4} ry={2.4} fill="#5eead4" {...ink} strokeWidth={1.5} />
    </>
  );
}

function Momo({ color, logo }: { color: string; logo: string }) {
  return (
    <>
      <circle cx={12} cy={16} r={6} fill="#f5f5f4" {...ink} />
      <circle cx={36} cy={16} r={6} fill="#f5f5f4" {...ink} />
      <circle cx={12} cy={16} r={2.6} fill="#c4b5fd" stroke="none" />
      <circle cx={36} cy={16} r={2.6} fill="#c4b5fd" stroke="none" />
      <path d="M8 36q-4-14 6-20 10-5 20 0 10 6 6 20 0 13-16 13T8 36Z" fill="#f5f5f4" {...ink} />
      <Eyes y={26} gap={6.5} />
      <ellipse cx={24} cy={30.5} rx={3.4} ry={2.3} fill="#fff" {...ink} strokeWidth={1.2} />
      <ellipse cx={24} cy={29.8} rx={1.3} ry={0.9} fill={INK} />
      <Cheeks y={30} gap={11} color="#c4b5fd" />
      <Scarf color={color} logo={logo} y={37} />
    </>
  );
}

const DRAW = { bolo: Bolo, kitsu: Kitsu, piyo: Piyo, tunas: Tunas, momo: Momo } as const;

/** A booth mascot, `size` times its in-hall size (48 × 56 px). It hops gently unless `still`. */
export function Mascot({ kind, color, logo, size = 1, still }: { kind?: string; color: string; logo: string; size?: number; still?: boolean }) {
  const Draw = DRAW[(kind as MascotKind) in DRAW ? (kind as MascotKind) : "bolo"];
  return (
    <svg width={48 * size} height={56 * size} viewBox="0 0 48 56" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={24} cy={52} rx={14} ry={3} fill="rgb(0 0 0 / 0.18)" />
      <g className={still ? undefined : "jb-hop"}>
        <Draw color={color} logo={logo} />
      </g>
    </svg>
  );
}
