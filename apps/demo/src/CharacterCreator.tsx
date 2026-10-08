import { useState } from "react";
import { type Face, type HairStyle, type Look, type Outfit, PLAYER_LOOK, Person, lookFor } from "@vwo/ui";

const HAIR_STYLES: HairStyle[] = ["long", "short", "bob", "ponytail", "pigtails", "braid", "bun", "buns", "curly", "spiky", "afro", "messy", "mohawk", "bald"];
const OUTFITS: Outfit[] = ["hoodie", "tee", "kemeja", "blazer", "batik", "jacket", "dress", "overall", "flannel", "vest", "explorer"];
const HATS: (Look["hat"] | "none")[] = ["beanie", "none", "hijab", "peci", "cap", "straw", "beret", "bucket", "bandana"];
const FACES: Face[] = ["smile", "happy", "grin", "calm"];
const FACE_NAMES: Record<Face, string> = { smile: "Senyum", happy: "Ceria", grin: "Nyengir", calm: "Kalem" };
const EXTRAS = ["none", "glasses", "backpack", "both"] as const;
const EXTRA_NAMES = { none: "Tidak ada", glasses: "Kacamata", backpack: "Ransel", both: "Kacamata + ransel" } as const;
const PANTS = ["#2f3e5c", "#1f2937", "#3f3f46", "#4b3a2a", "#365314", "#7c2d12", "#e5e7eb"];
const SKINS = ["#fde0c8", "#fbd6b8", "#f1c27d", "#e0ac69", "#c68642", "#a0663a", "#8d5524"];
const HAIRS = ["#5a3622", "#3b2418", "#26201f", "#7a4a26", "#b7652d", "#d9a441", "#9a3b2e", "#3b2f5c"];
const COLORS = ["#fbbf24", "#ef4444", "#2563eb", "#16a34a", "#7c3aed", "#0f766e", "#db2777", "#f97316", "#f8fafc", "#1f2937"];

const HAIR_NAMES: Record<HairStyle, string> = {
  long: "Panjang", short: "Pendek", bob: "Bob", ponytail: "Kuncir", pigtails: "Kuncir dua", bun: "Cepol",
  curly: "Keriting", spiky: "Jabrik", afro: "Afro", messy: "Acak", mohawk: "Mohawk", bald: "Botak", braid: "Kepang", buns: "Cepol dua",
};
const OUTFIT_NAMES: Record<Outfit, string> = {
  hoodie: "Hoodie", tee: "Kaos", jacket: "Jaket", dress: "Dress", overall: "Overall", flannel: "Flanel",
  vest: "Rompi", explorer: "Petualang", labcoat: "Jas lab", apron: "Celemek", batik: "Batik", blazer: "Blazer", kemeja: "Kemeja + dasi",
};
const HAT_NAMES: Record<string, string> = {
  beanie: "Kupluk", none: "Tanpa topi", cap: "Topi", straw: "Topi jerami", beret: "Baret", bucket: "Bucket", hijab: "Hijab", peci: "Peci", bandana: "Bandana",
};
const extraOf = (l: Look): (typeof EXTRAS)[number] => (l.glasses && l.backpack ? "both" : l.glasses ? "glasses" : l.backpack ? "backpack" : "none");
const DIRS = ["down", "side", "up"] as const;

const STORE_KEY = "vwo:character";

export interface Character {
  name: string;
  look: Look;
}

export function loadCharacter(): Character | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Character) : null;
  } catch {
    return null;
  }
}

function saveCharacter(c: Character) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    // Private mode or blocked storage: the character just isn't remembered.
  }
}

function cycle<T>(list: readonly T[], current: T, step: number): T {
  const i = list.indexOf(current);
  return list[(i + step + list.length) % list.length]!;
}

/** Pokémon-style "who are you?" screen: name, a few looks, and who came along. Then check in. */
export function CharacterCreator({
  onCheckIn,
  withCompanions = true,
  cta = "Check-in ▶",
  note = "Di cafe sungguhan, check-in lewat scan QR di pintu masuk.",
}: {
  onCheckIn: (c: Character, companions: number) => void;
  /** Ask who came along (a cafe visit) or not (a job fair). */
  withCompanions?: boolean;
  cta?: string;
  note?: string;
}) {
  const saved = loadCharacter();
  const [name, setName] = useState(saved?.name ?? "");
  const [look, setLook] = useState<Look>(saved?.look ?? PLAYER_LOOK);
  const [companions, setCompanions] = useState(0);
  const [dir, setDir] = useState(0);
  const set = (patch: Partial<Look>) => setLook((l) => ({ ...l, ...patch }));

  const submit = () => {
    const c = { name: name.trim().slice(0, 16) || "Kamu", look };
    saveCharacter(c);
    onCheckIn(c, companions);
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="cc-row">
      <span className="cc-label">{label}</span>
      {children}
    </div>
  );
  const Picker = ({ value, onPrev, onNext }: { value: string; onPrev: () => void; onNext: () => void }) => (
    <span className="cc-picker">
      <button type="button" onClick={onPrev} aria-label="Sebelumnya">◀</button>
      <span>{value}</span>
      <button type="button" onClick={onNext} aria-label="Berikutnya">▶</button>
    </span>
  );
  const Swatches = ({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) => (
    <span className="cc-swatches">
      {colors.map((c) => (
        <button key={c} type="button" aria-label={c} data-active={c === value ? "" : undefined} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
    </span>
  );

  return (
    <form
      className="rpg-box cc"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="cc-preview">
        <div className="cc-stage rpg-sprite-preview" data-dir={DIRS[dir]}>
          <div className="pg-flip">
            <Person look={look} size={2.4} />
          </div>
        </div>
        <span className="cc-picker">
          <button type="button" onClick={() => setDir((d) => (d + 2) % 3)} aria-label="Putar kiri">⟲</button>
          <span>Putar</span>
          <button type="button" onClick={() => setDir((d) => (d + 1) % 3)} aria-label="Putar kanan">⟳</button>
        </span>
        <button type="button" className="cc-random" onClick={() => setLook(lookFor(`${Math.random()}`, { backpack: Math.random() < 0.3 ? "#7c4a2a" : undefined }))}>
          🎲 Acak
        </button>
      </div>
      <div className="cc-fields">
        <h2 className="cc-title">Siapa namamu?</h2>
        <input className="cc-name" placeholder="Nickname" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Row label="Rambut">
          <Picker value={HAIR_NAMES[look.style]} onPrev={() => set({ style: cycle(HAIR_STYLES, look.style, -1) })} onNext={() => set({ style: cycle(HAIR_STYLES, look.style, 1) })} />
        </Row>
        <Row label="Warna rambut">
          <Swatches colors={HAIRS} value={look.hair} onPick={(hair) => set({ hair })} />
        </Row>
        <Row label="Kulit">
          <Swatches colors={SKINS} value={look.skin} onPick={(skin) => set({ skin })} />
        </Row>
        <Row label="Baju">
          <Picker value={OUTFIT_NAMES[look.outfit]} onPrev={() => set({ outfit: cycle(OUTFITS, look.outfit, -1) })} onNext={() => set({ outfit: cycle(OUTFITS, look.outfit, 1) })} />
        </Row>
        <Row label="Warna baju">
          <Swatches colors={COLORS} value={look.shirt} onPick={(shirt) => set({ shirt })} />
        </Row>
        <Row label="Warna aksen">
          <Swatches colors={COLORS} value={look.accent} onPick={(accent) => set({ accent })} />
        </Row>
        <Row label="Celana">
          <Swatches colors={PANTS} value={look.pants} onPick={(pants) => set({ pants })} />
        </Row>
        <Row label="Topi">
          <Picker
            value={HAT_NAMES[look.hat ?? "none"] ?? ""}
            onPrev={() => {
              const h = cycle(HATS, look.hat ?? "none", -1);
              set({ hat: h === "none" ? undefined : h });
            }}
            onNext={() => {
              const h = cycle(HATS, look.hat ?? "none", 1);
              set({ hat: h === "none" ? undefined : h });
            }}
          />
        </Row>
        {look.hat && look.hat !== "peci" && (
          <Row label="Warna topi">
            <Swatches colors={COLORS} value={look.hatColor ?? ""} onPick={(hatColor) => set({ hatColor })} />
          </Row>
        )}
        <Row label="Ekspresi">
          <Picker value={FACE_NAMES[look.face]} onPrev={() => set({ face: cycle(FACES, look.face, -1) })} onNext={() => set({ face: cycle(FACES, look.face, 1) })} />
        </Row>
        <Row label="Aksesori">
          <Picker
            value={EXTRA_NAMES[extraOf(look)]}
            onPrev={() => {
              const x = cycle(EXTRAS, extraOf(look), -1);
              set({ glasses: x === "glasses" || x === "both", backpack: x === "backpack" || x === "both" ? "#7c4a2a" : undefined });
            }}
            onNext={() => {
              const x = cycle(EXTRAS, extraOf(look), 1);
              set({ glasses: x === "glasses" || x === "both", backpack: x === "backpack" || x === "both" ? "#7c4a2a" : undefined });
            }}
          />
        </Row>
        {withCompanions && (
        <Row label="Datang bersama">
          <Picker
            value={companions === 0 ? "Sendiri" : `${companions} orang (NPC)`}
            onPrev={() => setCompanions((n) => Math.max(0, n - 1))}
            onNext={() => setCompanions((n) => Math.min(5, n + 1))}
          />
        </Row>
        )}
        <button type="submit" className="cc-go">
          {cta}
        </button>
        <p className="cc-note">{note}</p>
      </div>
    </form>
  );
}
