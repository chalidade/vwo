// Vendored from chalidade/tools (src/components/playground/Person.tsx, MIT, same author), the
// character style of the walkable town on chalidade.github.io/tools. Changes here: the
// `overflow-visible` utility became an inline style, `at()` is typed for noUncheckedIndexedAccess,
// and Person is memoised so a moving sprite does not redraw its whole SVG every frame.
import { createContext, memo, useContext, useId } from 'react'

/*
 * A chibi character in a "2D casual game" style: big head, thick dark
 * outlines, flat colours. 44×62, feet at the bottom edge. Every colour and
 * garment comes from a `Look`, so the player, the keepers and the townsfolk are
 * all the same drawing dressed differently.
 *
 * It's drawn from three sides: front, back, and a right-facing profile (left
 * is the profile mirrored by the sprite's `.pg-flip`). CSS shows one at a time
 * from the sprite's `data-dir` ("down" or unset → front, "up" → back,
 * "side" → profile). Animation hooks: `.pg-body` bobs, `.pg-leg-*` step and
 * `.pg-arm-*` swing while the sprite has `data-walking`.
 */

export type HairStyle =
  | 'short'
  | 'long'
  | 'bun'
  | 'spiky'
  | 'curly'
  | 'ponytail'
  | 'pigtails'
  | 'bob'
  | 'afro'
  | 'mohawk'
  | 'bald'
  | 'messy'
  /** One braid over the shoulder. */
  | 'braid'
  /** Two buns on top. */
  | 'buns'
export type Hat = 'cap' | 'beanie' | 'straw' | 'beret' | 'guard' | 'hardhat' | 'bucket' | 'hijab' | 'peci' | 'bandana'
export type Outfit =
  | 'tee'
  | 'hoodie'
  | 'jacket'
  | 'dress'
  | 'overall'
  | 'labcoat'
  | 'apron'
  | 'vest'
  /** Open plaid shirt over a tee (accent = the tee). */
  | 'flannel'
  /** Khaki vest with pockets and a camera (accent = the vest). */
  | 'explorer'
  /** Batik shirt (accent = the motif). */
  | 'batik'
  /** Blazer over a white shirt and a tie (accent = the tie). */
  | 'blazer'
  /** Long-sleeved shirt with a tie (accent = the tie). */
  | 'kemeja'
export type Face = 'smile' | 'happy' | 'grin' | 'calm'

export interface Look {
  skin: string
  hair: string
  style: HairStyle
  outfit: Outfit
  shirt: string
  /** Second garment colour: jacket lining, apron, overall shirt, hoodie strings… */
  accent: string
  pants: string
  shoes: string
  face: Face
  hat?: Hat
  hatColor?: string
  glasses?: boolean
  mustache?: boolean
  freckles?: boolean
  backpack?: string
  cane?: boolean
  /** Shorts instead of trousers: bare legs below the knee. */
  shorts?: boolean
  /** A little graphic on a tee. */
  print?: boolean
  /** Something carried. */
  prop?: 'skateboard'
}

const SKINS = ['#fde0c8', '#fbd6b8', '#f1c27d', '#e0ac69', '#c68642', '#a0663a', '#8d5524']
const HAIRS = ['#3b2418', '#5a3622', '#26201f', '#7a4a26', '#b7652d', '#d9a441', '#9a3b2e', '#3b2f5c']
const STYLES: HairStyle[] = ['short', 'long', 'bun', 'spiky', 'curly', 'ponytail', 'pigtails', 'bob', 'afro', 'messy', 'braid', 'buns', 'mohawk']
const OUTFITS: Outfit[] = ['tee', 'hoodie', 'jacket', 'dress', 'overall', 'vest', 'flannel', 'hoodie', 'tee', 'batik', 'blazer', 'kemeja', 'batik']
const HATS: (Hat | undefined)[] = [undefined, undefined, undefined, undefined, 'cap', 'beanie', 'straw', 'beret', 'bucket', 'hijab', 'hijab', 'peci', 'bandana']
const FACES: Face[] = ['smile', 'happy', 'grin', 'calm']
const PANTS = ['#2f3e5c', '#1e3a5f', '#3f3f46', '#4b3a2a', '#365314', '#7c2d12', '#1f2937']
const ACCENTS = ['#fef3c7', '#e0f2fe', '#fce7f3', '#dcfce7', '#f1f5f9', '#ede9fe', '#ffedd5']
const SHOES = ['#f97316', '#7c2d12', '#1e3a8a', '#f8fafc', '#b91c1c', '#16a34a']
const HAT_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0f766e', '#db2777', '#f97316']

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A stable look for a seed (a tool slug, a resident's name), with anything in `over` forced. */
export function lookFor(seed: string, over: Partial<Look> = {}): Look {
  const h = hash(seed)
  const g = hash(`${seed}#`)
  const at = <T,>(list: readonly T[], shift: number, src = h) => list[(src >>> shift) % list.length] as T
  return {
    skin: at(SKINS, 0),
    hair: at(HAIRS, 3),
    style: at(STYLES, 6),
    outfit: at(OUTFITS, 10),
    shirt: at(HAT_COLORS, 0, g),
    accent: at(ACCENTS, 4, g),
    pants: at(PANTS, 13),
    shoes: at(SHOES, 8, g),
    face: at(FACES, 16),
    hat: at(HATS, 18),
    hatColor: at(HAT_COLORS, 12, g),
    glasses: (h >>> 21) % 5 === 0,
    freckles: (h >>> 24) % 4 === 0,
    mustache: (g >>> 20) % 9 === 0,
    ...over,
  }
}

/** The player: orange beanie, long brown hair, yellow hoodie, backpack. */
export const PLAYER_LOOK: Look = {
  skin: '#fbd6b8',
  hair: '#5a3622',
  style: 'long',
  outfit: 'hoodie',
  shirt: '#fbbf24',
  accent: '#fffbeb',
  pants: '#2f3e5c',
  shoes: '#f97316',
  face: 'smile',
  hat: 'beanie',
  hatColor: '#f97316',
  backpack: '#7c4a2a',
}

// ---------------------------------------------------------------- shared bits

/** The outline colour and width every shape shares — the style's "ink". */
const INK = '#2b1e19'
const W = 1.4
const ink = { stroke: INK, strokeWidth: W, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const fill = (color: string) => ({ fill: color })
/** A darker shade of any colour, for shading and folds. */
const Shade = ({ d, opacity = 0.18 }: { d: string; opacity?: number }) => <path d={d} fill="black" opacity={opacity} />

const sleeveOf = (look: Look) => (look.outfit === 'labcoat' || look.outfit === 'kemeja' ? '#f8fafc' : look.outfit === 'vest' ? look.accent : look.shirt)
const legsOf = (look: Look) => (look.outfit === 'dress' ? look.skin : look.pants)
const hatOf = (look: Look) => look.hatColor ?? '#f97316'
/** Hair that shows below a hat: no top tufts, just what frames the face. */
const longHair = (s: HairStyle) => s === 'long' || s === 'bob' || s === 'pigtails'
const BODY = 'M12 37q0-6 6-6h8q6 0 6 6v10.5q0 2-2 2H14q-2 0-2-2Z'
const SIDE_BODY = 'M14 37q0-6 5-6h6q5 0 5 6v10.5q0 2-2 2H16q-2 0-2-2Z'

/** Checks for a flannel shirt, clipped to the garment's outline. */
function Plaid({ d }: { d: string }) {
  const id = useId()
  return (
    <>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`} stroke="black" opacity="0.22">
        {[4, 10, 16, 22, 28, 34, 40].map((x) => (
          <path key={`v${x}`} d={`M${x} 28v26`} strokeWidth="2.2" />
        ))}
        {[34, 40, 46, 52].map((y) => (
          <path key={`h${y}`} d={`M0 ${y}h44`} strokeWidth="2.2" />
        ))}
      </g>
    </>
  )
}

/** A skateboard held upright by the hand at (x, y). */
/** Batik motif (kawung-like rings and dots) clipped to a body shape. */
function Batik({ d, color }: { d: string; color: string }) {
  const id = useId()
  return (
    <>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`} fill="none" stroke={color} strokeWidth="1.1" opacity="0.85">
        {[33, 39, 45, 51].flatMap((y, r) =>
          [8, 14, 20, 26, 32, 38].map((x) => <ellipse key={`${x}-${y}`} cx={x + (r % 2) * 3} cy={y} rx="2.2" ry="1.4" transform={`rotate(45 ${x + (r % 2) * 3} ${y})`} />),
        )}
        {[36, 42, 48].flatMap((y) => [11, 17, 23, 29, 35].map((x) => <circle key={`d${x}-${y}`} cx={x} cy={y} r="0.6" fill={color} stroke="none" />))}
      </g>
    </>
  )
}

function Skateboard({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 3} y={y - 9} width="6" height="21" rx="3" fill="#1f2937" {...ink} />
      <path d={`M${x - 1.6} ${y - 5}v13`} stroke="#f97316" strokeWidth="1.4" />
      <circle cx={x - 3.6} cy={y - 5} r="1.5" fill="#fde68a" {...ink} strokeWidth={0.8} />
      <circle cx={x - 3.6} cy={y + 8} r="1.5" fill="#fde68a" {...ink} strokeWidth={0.8} />
    </g>
  )
}

export const Person = memo(PersonSvg, (a, b) => a.size === b.size && JSON.stringify(a.look) === JSON.stringify(b.look))

function PersonSvg({ look: given, size = 1 }: { look: Look; size?: number }) {
  const id = useId().replace(/:/g, '')
  // A hijab covers the hair entirely.
  const look = given.hat === 'hijab' ? { ...given, style: 'bald' as const, hair: given.skin } : given
  return (
    <svg viewBox="0 0 44 62" width={44 * size} height={62 * size} className="pg-body" style={{ overflow: 'visible' }}>
      <LightDefs id={id} />
      <Light.Provider value={id}>
        <g className="pg-v-front">
          <Front look={look} />
        </g>
        <g className="pg-v-back">
          <Back look={look} />
        </g>
        <g className="pg-v-side">
          <Side look={look} />
        </g>
      </Light.Provider>
    </svg>
  )
}

// ---------------------------------------------------------------- light

/*
 * Soft light from the top left gives the flat chibi a rounded, semi-3D look: a highlight and
 * a core shadow on the head, a rim of shade on the body and limbs, and a gloss on the hair.
 * Each Person has its own gradients (ids from useId), shared by its three views.
 */
const Light = createContext('')

function LightDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}h`} cx="0.36" cy="0.3" r="0.78">
        <stop offset="0" stopColor="white" stopOpacity="0.55" />
        <stop offset="0.32" stopColor="white" stopOpacity="0" />
        <stop offset="0.7" stopColor="black" stopOpacity="0" />
        <stop offset="1" stopColor="black" stopOpacity="0.34" />
      </radialGradient>
      <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0" stopColor="white" stopOpacity="0.28" />
        <stop offset="0.35" stopColor="white" stopOpacity="0" />
        <stop offset="0.65" stopColor="black" stopOpacity="0" />
        <stop offset="1" stopColor="black" stopOpacity="0.32" />
      </linearGradient>
      <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="white" stopOpacity="0.32" />
        <stop offset="0.45" stopColor="white" stopOpacity="0" />
        <stop offset="1" stopColor="black" stopOpacity="0.3" />
      </linearGradient>
    </defs>
  )
}

function HeadLight({ cx = 22 }: { cx?: number }) {
  const id = useContext(Light)
  return <circle cx={cx} cy="20" r="12.3" fill={`url(#${id}h)`} pointerEvents="none" />
}

function BodyLight({ d }: { d: string }) {
  const id = useContext(Light)
  return <path d={d} fill={`url(#${id}b)`} pointerEvents="none" />
}

function LimbLight({ x, y, w, h, r = 3 }: { x: number; y: number; w: number; h: number; r?: number }) {
  const id = useContext(Light)
  return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={r} fill={`url(#${id}l)`} pointerEvents="none" />
}

/** A shine on the hair's crown, and the shadow the head casts on the shoulders. */
const HairGloss = ({ x = 0 }: { x?: number }) => (
  <path d={`M${13.5 + x} 13.5q3-5.2 8.5-6`} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" pointerEvents="none" />
)
const NeckShadow = ({ cx = 22 }: { cx?: number }) => <ellipse cx={cx} cy="32.6" rx="8" ry="2.2" fill="black" opacity="0.16" pointerEvents="none" />

// ---------------------------------------------------------------- front

function Front({ look }: { look: Look }) {
  const { skin, hair, style } = look
  return (
    <>
      {/* Hair that falls behind the shoulders. */}
      {style === 'long' && <path d="M8.5 18c-1.5 9-1 17 2.5 25h22c3.5-8 4-16 2.5-25Z" style={fill(hair)} {...ink} />}
      {style === 'bob' && <path d="M8.5 18c-1 6-.5 11 1.5 15h24c2-4 2.5-9 1.5-15Z" style={fill(hair)} {...ink} />}
      {style === 'pigtails' && (
        <g style={fill(hair)} {...ink}>
          <path d="M9 22c-5 3-6 11-3 16 2-4 4-8 5-13Z" />
          <path d="M35 22c5 3 6 11 3 16-2-4-4-8-5-13Z" />
        </g>
      )}
      {style === 'ponytail' && <path d="M33 14c7 4 7 15 3 22-1-6-3-11-6-14Z" style={fill(hair)} {...ink} />}

      <Legs look={look} />
      {/* Arms. */}
      <g className="pg-arm-a">
        <rect x="7.5" y="32" width="6" height="13" rx="3" style={fill(sleeveOf(look))} {...ink} />
        <LimbLight x={7.5} y={32} w={6} h={13} />
        <circle cx="10.5" cy="45.5" r="2.5" style={fill(skin)} {...ink} />
        {look.cane && <path d="M10.5 46v14" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />}
      </g>
      <g className="pg-arm-b">
        {look.prop === 'skateboard' && <Skateboard x={36.5} y={46} />}
        <rect x="30.5" y="32" width="6" height="13" rx="3" style={fill(sleeveOf(look))} {...ink} />
        <LimbLight x={30.5} y={32} w={6} h={13} />
        <circle cx="33.5" cy="45.5" r="2.5" style={fill(skin)} {...ink} />
      </g>
      <TorsoFront look={look} />
      <BodyLight d={BODY} />
      <NeckShadow />
      {look.backpack && (
        <g stroke={look.backpack} strokeWidth="2.2" strokeLinecap="round">
          <path d="M14.2 32.5q.6 4 .3 8.5M29.8 32.5q-.6 4-.3 8.5" />
        </g>
      )}

      {/* Head. */}
      <circle cx="22" cy="20" r="13" style={fill(skin)} {...ink} />
      <HeadLight />
      <FaceFront look={look} />
      <HairFront look={look} />
      {look.style !== 'bald' && !look.hat && <HairGloss />}
      {look.hat && <HatFront hat={look.hat} color={hatOf(look)} />}
    </>
  )
}

function Legs({ look, side = false }: { look: Look; side?: boolean }) {
  const legs = legsOf(look)
  const leg = (x: number, cls: string) => (
    <g className={cls}>
      {look.shorts ? (
        <>
          <rect x={x + 0.6} y="49" width="5.3" height="7" rx="2" style={fill(look.skin)} {...ink} />
          <rect x={x} y="45" width="6.5" height="5.5" rx="2" style={fill(legs)} {...ink} />
        </>
      ) : (
        <rect x={x} y="45" width="6.5" height="11" rx="2.5" style={fill(legs)} {...ink} />
      )}
      <LimbLight x={x} y={45} w={6.5} h={look.shorts ? 5.5 : 11} r={2.5} />
      <path
        d={side ? `M${x - 0.5} 55.5h8.5a2.6 2.6 0 0 1 0 5.2h-8.5Z` : `M${x - 1.2} 55.5h8.9a2.6 2.6 0 0 1 0 5.2h-8.9a2.6 2.6 0 0 1 0-5.2Z`}
        style={fill(look.shoes)}
        {...ink}
      />
      <path d={`M${x - 0.5} 59.6h8`} stroke="white" strokeWidth="1.2" opacity="0.85" />
    </g>
  )
  return side ? (
    <>
      {leg(19, 'pg-leg-b')}
      {leg(17, 'pg-leg-a')}
    </>
  ) : (
    <>
      {leg(14, 'pg-leg-a')}
      {leg(23.5, 'pg-leg-b')}
    </>
  )
}

function TorsoFront({ look }: { look: Look }) {
  const { shirt, accent, pants, outfit } = look
  const body = BODY
  switch (outfit) {
    case 'hoodie':
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <Shade d="M12 45h20v2.5q0 2-2 2H14q-2 0-2-2Z" />
          <path d="M15.5 31.5q6.5 5 13 0" fill="none" {...ink} />
          <path d="M16.5 42h11v4.5h-11Z" fill="black" opacity="0.1" />
          <path d="M16.5 42h11" fill="none" {...ink} strokeWidth={1} />
          <g stroke={accent} strokeWidth="1.3" strokeLinecap="round">
            <path d="M19.5 34v4.5M24.5 34v4.5" />
          </g>
          <circle cx="19.5" cy="39.2" r="0.9" style={fill(accent)} />
          <circle cx="24.5" cy="39.2" r="0.9" style={fill(accent)} />
        </>
      )
    case 'dress':
      return (
        <>
          <path d="M13 37q0-6 6-6h6q6 0 6 6l4.5 14H8.5Z" style={fill(shirt)} {...ink} />
          <path d="M11.5 44h21" stroke={accent} strokeWidth="2" />
          <circle cx="22" cy="34" r="1.3" style={fill(accent)} {...ink} strokeWidth={0.8} />
        </>
      )
    case 'overall':
      return (
        <>
          <path d={body} style={fill(accent)} {...ink} />
          <path d="M15 37h14v10.5q0 2-2 2H17q-2 0-2-2Z" style={fill(pants)} {...ink} />
          <path d="M15.5 37.5l-1.5-6M28.5 37.5l1.5-6" stroke={pants} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="17" cy="39" r="1" fill="#fde68a" />
          <circle cx="27" cy="39" r="1" fill="#fde68a" />
        </>
      )
    case 'labcoat':
      return (
        <>
          <path d="M11 37q0-6 6-6h10q6 0 6 6v15H11Z" fill="#f8fafc" {...ink} />
          <path d="M19 31.5h6l-1 9h-4Z" style={fill(shirt)} {...ink} strokeWidth={1} />
          <path d="M22 40.5v11.5" stroke={INK} strokeWidth="0.9" />
          <rect x="25" y="42" width="5" height="4" rx="1" fill="none" stroke={INK} strokeWidth="0.9" />
        </>
      )
    case 'apron':
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <path d="M15.5 35.5h13v13.5q0 1.5-1.5 1.5H17q-1.5 0-1.5-1.5Z" style={fill(accent)} {...ink} />
          <path d="M15.5 35.5q6.5-5.5 13 0" fill="none" stroke={INK} strokeWidth="1" />
        </>
      )
    case 'jacket':
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <path d="M19.5 31.5h5v18h-5Z" style={fill(accent)} {...ink} strokeWidth={1} />
          <path d="M19.5 31.5 17 36l2.5 1.5M24.5 31.5 27 36l-2.5 1.5" style={fill(shirt)} {...ink} strokeWidth={1} />
        </>
      )
    case 'vest':
      return (
        <>
          <path d={body} style={fill(accent)} {...ink} />
          <path d="M12 37q0-6 6-6l3 9-2 9.5h-5q-2 0-2-2ZM32 37q0-6-6-6l-3 9 2 9.5h5q2 0 2-2Z" style={fill(shirt)} {...ink} />
        </>
      )
    case 'flannel':
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <Plaid d={body} />
          <path d="M18 31.5h8v18h-8Z" style={fill(accent)} {...ink} strokeWidth={1} />
          <path d="M18 31.5 16 37l2 1.5M26 31.5 28 37l-2 1.5" style={fill(shirt)} {...ink} strokeWidth={1} />
        </>
      )
    case 'batik':
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <Batik d={body} color={accent} />
          <path d="M17.5 31.5 22 34.5l4.5-3-1 3.5L22 36l-3.5-1Z" style={fill(shirt)} {...ink} strokeWidth={1} />
          <path d="M22 36v13" stroke={INK} strokeWidth="0.8" opacity="0.6" />
        </>
      )
    case 'blazer':
    case 'kemeja': {
      const blazer = outfit === 'blazer'
      return (
        <>
          <path d={body} style={fill(blazer ? shirt : '#f8fafc')} {...ink} />
          {blazer && <path d="M18.5 31.5h7l-1.5 10h-4Z" fill="#f8fafc" {...ink} strokeWidth={1} />}
          {!blazer && <path d="M12 37q0-6 6-6h8q6 0 6 6v1H12Z" style={fill(shirt)} opacity="0.35" />}
          <path d="M20.6 33.5h2.8l-.4 1.6 1 6.5-2 2-2-2 1-6.5Z" style={fill(accent)} {...ink} strokeWidth={0.9} />
          <path d="M18.5 31.5 22 34l3.5-2.5" fill="#f8fafc" {...ink} strokeWidth={1} />
          {blazer && <path d="M18.5 31.5 16.5 37l3 1.5 1-3M25.5 31.5 27.5 37l-3 1.5-1-3" style={fill(shirt)} {...ink} strokeWidth={1} />}
          {blazer && <circle cx="22" cy="46" r="0.8" fill={INK} />}
        </>
      )
    }
    case 'explorer':
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <path d="M12 37q0-6 6-6l2.5 3v15.5H14q-2 0-2-2ZM32 37q0-6-6-6l-2.5 3v15.5H30q2 0 2-2Z" style={fill(accent)} {...ink} />
          <rect x="13.5" y="40" width="4.5" height="4" rx="1" fill="black" opacity="0.15" stroke={INK} strokeWidth="0.8" />
          <rect x="26" y="40" width="4.5" height="4" rx="1" fill="black" opacity="0.15" stroke={INK} strokeWidth="0.8" />
          {/* Camera on a strap. */}
          <path d="M16.5 32q5.5 6 11 0" fill="none" stroke={INK} strokeWidth="1" />
          <rect x="17.5" y="36.5" width="9" height="6.5" rx="1.6" fill="#374151" {...ink} />
          <circle cx="22" cy="39.8" r="2" fill="#94a3b8" {...ink} strokeWidth={0.9} />
        </>
      )
    default:
      return (
        <>
          <path d={body} style={fill(shirt)} {...ink} />
          <Shade d="M12 45h20v2.5q0 2-2 2H14q-2 0-2-2Z" />
          <path d="M18.5 31.5 22 35l3.5-3.5" fill="none" {...ink} strokeWidth={1.1} />
          {look.print && (
            <>
              <circle cx="22" cy="40.5" r="3.4" style={fill(accent)} {...ink} strokeWidth={0.9} />
              <path d="M20.3 40.5h3.4M22 38.8v3.4" stroke={INK} strokeWidth="0.9" />
            </>
          )}
        </>
      )
  }
}

function FaceFront({ look }: { look: Look }) {
  return (
    <g className="pg-face">
      {look.face === 'happy' ? (
        <g className="pg-eyes" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round">
          <path d="M15 22.5q2-2.4 4 0" />
          <path d="M25 22.5q2-2.4 4 0" />
        </g>
      ) : (
        <g className="pg-eyes">
          <ellipse className="pg-eye" cx="17" cy="22" rx="1.8" ry={look.face === 'calm' ? 1.6 : 2.5} fill={INK} />
          <ellipse className="pg-eye" cx="27" cy="22" rx="1.8" ry={look.face === 'calm' ? 1.6 : 2.5} fill={INK} />
          <circle cx="17.6" cy="21" r="0.65" fill="white" />
          <circle cx="27.6" cy="21" r="0.65" fill="white" />
        </g>
      )}
      <ellipse cx="13.8" cy="26" rx="2" ry="1.2" fill="#fb7185" opacity="0.4" />
      <ellipse cx="30.2" cy="26" rx="2" ry="1.2" fill="#fb7185" opacity="0.4" />
      {look.freckles && (
        <g fill="#b45309" opacity="0.5">
          <circle cx="14.5" cy="24.5" r="0.6" />
          <circle cx="16.3" cy="25.4" r="0.6" />
          <circle cx="29.5" cy="24.5" r="0.6" />
          <circle cx="27.7" cy="25.4" r="0.6" />
        </g>
      )}
      {look.mustache ? (
        <path d="M18 27.2q4-2.6 8 0q-4 1.4-8 0Z" style={fill(look.hair)} />
      ) : look.face === 'grin' ? (
        <path d="M19.5 26.6h5q-.4 3-2.5 3t-2.5-3Z" fill="#7c2d12" {...ink} strokeWidth={0.8} />
      ) : look.face === 'calm' ? (
        <path d="M20.5 27.6h3" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
      ) : (
        <path d="M20.3 27q1.7 1.6 3.4 0" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
      )}
      {look.glasses && (
        <g fill="none" stroke={INK} strokeWidth="1.1">
          <circle cx="17" cy="22" r="3.6" />
          <circle cx="27" cy="22" r="3.6" />
          <path d="M20.6 22h2.8" />
        </g>
      )}
    </g>
  )
}

function HairFront({ look }: { look: Look }) {
  const { hair, style } = look
  const f = { ...fill(hair), ...ink }
  const hatted = !!look.hat
  // Bangs and the locks framing the face, common to most styles.
  const fringe = <path d="M10.5 20q2-7 11.5-7.5 9.5.5 11.5 7.5-3-3-5.5-2.5-1.5 2.5-6 2.5t-6-2.5Q13.5 17 10.5 20Z" {...f} />
  const locks = (to: number) => (
    <>
      <path d={`M9.5 17q-1.5 ${to / 3} .5 ${to}l3-1q-1-${to / 2} 0-${to - 4}Z`} {...f} />
      <path d={`M34.5 17q1.5 ${to / 3} -.5 ${to}l-3-1q1-${to / 2} 0-${to - 4}Z`} {...f} />
    </>
  )
  switch (style) {
    case 'bald':
      return <path d="M9.4 22q-.4-4 1.6-6M34.6 22q.4-4-1.6-6" stroke={hair} strokeWidth="3" strokeLinecap="round" fill="none" />
    case 'messy':
      return (
        <>
          {!hatted && (
            <>
              <path d="M9 21q-1.5-9 4-13 0-3.5 4-3.5 2.5-3 6-1.5 3.5-1.5 6 1.5 4 .5 5 4.5 2.5 4 1 12l-2.5-4-1.5 3-2.5-5-2 4-3-5-2.5 5-2.5-4-2 4-2.5-3-1 4Z" {...f} />
              <path d="M16 5q1 2.5 3.5 3M25 4.5q-.5 2.5-3 3.5M31 8.5q-2 .5-3.5 2.5" fill="none" stroke={INK} strokeWidth="1" />
            </>
          )}
          {hatted && fringe}
        </>
      )
    case 'spiky':
    case 'mohawk':
      return hatted ? fringe : <path d="M9.5 19 8 9.5l5 2.2 2-7.2 4 5.2 3-6.2 3 6.2 4-5.2 2 7.2 5-2.2-1.5 9.5q-2.5-4-12.5-5.5-10 1.5-12.5 5.5Z" {...f} />
    case 'curly':
    case 'afro': {
      const big = style === 'afro'
      return (
        <g {...f}>
          {(big
            ? [
                [10, 14, 6],
                [16, 8, 6.5],
                [22, 6, 7],
                [28, 8, 6.5],
                [34, 14, 6],
              ]
            : [
                [12, 13, 4.5],
                [17, 9, 5],
                [22, 7.5, 5.2],
                [27, 9, 5],
                [32, 13, 4.5],
              ]
          ).map(([cx, cy, r]) => (hatted && cy! < 10 ? null : <circle key={`${cx}`} cx={cx} cy={cy} r={r} />))}
        </g>
      )
    }
    case 'long':
    case 'bob':
    case 'pigtails':
    case 'ponytail':
      return (
        <>
          {!hatted && <path d="M9 20C9 10.5 15 6.5 22 6.5S35 10.5 35 20Q31 13.5 22 13t-13 7Z" {...f} />}
          {longHair(style) && locks(style === 'bob' ? 14 : 18)}
          {fringe}
        </>
      )
    case 'braid':
      return (
        <>
          {!hatted && <path d="M9 20C9 10.5 15 6.5 22 6.5S35 10.5 35 20Q31 13.5 22 13t-13 7Z" {...f} />}
          <Braid x={32.5} y={24} n={5} f={f} />
          {fringe}
        </>
      )
    case 'buns':
      return (
        <>
          {!hatted && <circle cx="12.5" cy="8" r="4.6" {...f} />}
          {!hatted && <circle cx="31.5" cy="8" r="4.6" {...f} />}
          {!hatted && <path d="M9 20C9 10.5 15 6.5 22 6.5S35 10.5 35 20Q31 13.5 22 13t-13 7Z" {...f} />}
          {fringe}
        </>
      )
    case 'bun':
      return (
        <>
          {!hatted && <circle cx="22" cy="5" r="4.5" {...f} />}
          {!hatted && <path d="M9 20C9 10.5 15 6.5 22 6.5S35 10.5 35 20Q31 13.5 22 13t-13 7Z" {...f} />}
          {fringe}
        </>
      )
    default:
      return (
        <>
          {!hatted && <path d="M9 20C9 10.5 15 6.5 22 6.5S35 10.5 35 20Q31 13.5 22 13t-13 7Z" {...f} />}
          {fringe}
        </>
      )
  }
}

/** A plait: a chain of small lobes from (x, y) downwards, ending in a tie. */
function Braid({ x, y, n, f }: { x: number; y: number; n: number; f: Record<string, unknown> }) {
  return (
    <g {...f}>
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} cx={x + (i % 2 ? 0.6 : -0.6)} cy={y + i * 3.3} rx="2.6" ry="2.1" />
      ))}
      <path d={`M${x - 1.6} ${y + n * 3.3 - 0.8}h3.2l.8 3h-4.8Z`} />
    </g>
  )
}

/** A hat seen from the front (and, minus the visor, from behind). */
function HatFront({ hat, color, back = false }: { hat: Hat; color: string; back?: boolean }) {
  const f = { ...fill(color), ...ink }
  switch (hat) {
    case 'beanie':
      return (
        <>
          <path d="M8.5 17.5C8 7.5 14.5 2.5 22 2.5S36 7.5 35.5 17.5Z" {...f} />
          <Shade d="M30 5.5q5 4 5.5 12h-4q0-7-1.5-12Z" opacity={0.12} />
          <rect x="7.5" y="13.5" width="29" height="6.5" rx="3.2" {...f} />
          <Shade d="M7.5 16.7h29v.1q0 3.2-3.2 3.2H10.7q-3.2 0-3.2-3.2Z" opacity={0.15} />
          <g stroke={INK} strokeWidth="0.7" opacity="0.35">
            {[11, 14, 17, 20, 23, 26, 29, 32].map((x) => (
              <path key={x} d={`M${x} 14.5v4.5`} />
            ))}
          </g>
        </>
      )
    case 'bucket':
      return (
        <>
          <path d="M12 14.5c0-7 4-10.5 10-10.5s10 3.5 10 10.5Z" {...f} />
          <path d="M5 16q17-5 34 0l-2.5 4.5q-14.5-4-29 0Z" {...f} />
          <Shade d="M5 16q17-5 34 0l-.8 1.4q-16.2-4.4-32.4 0Z" opacity={0.15} />
          <path d="M12.3 12.5h19.4" stroke={INK} strokeWidth="1.2" opacity="0.6" />
        </>
      )
    case 'straw':
      return (
        <>
          <ellipse cx="22" cy="14" rx="19" ry="4.6" fill="#e9c46a" {...ink} />
          <path d="M13 14c0-6.5 4-9.5 9-9.5s9 3 9 9.5Z" fill="#e9c46a" {...ink} />
          <path d="M13.3 12h17.4" style={{ stroke: color }} strokeWidth="2.4" />
        </>
      )
    case 'beret':
      return (
        <>
          <ellipse cx="20" cy="9.5" rx="13.5" ry="5.8" transform="rotate(-10 20 9.5)" {...f} />
          <circle cx="21" cy="3.5" r="1.4" {...f} />
        </>
      )
    case 'guard':
      return (
        <>
          <path d="M9 14C9.5 6.5 15 3 22 3s12.5 3.5 13 11Z" fill="#1e3a5f" {...ink} />
          <rect x="8.5" y="12" width="27" height="3.6" rx="1.5" {...f} />
          {!back && <path d="M11 15.6h22q-1 3.6-11 3.6t-11-3.6Z" fill="#0f172a" {...ink} />}
          {!back && <path d="M22 5.8l2.4 1.4V10L22 11.3 19.6 10V7.2Z" fill="#facc15" />}
        </>
      )
    case 'hijab':
      return (
        <>
          <path
            d={`M22 5.5C13.5 5.5 7.5 11.5 7.5 20c0 3.5.8 6.5 2 9C7 31 5.5 33.5 5.5 37.5h33c0-4-1.5-6.5-4-8.5 1.2-2.5 2-5.5 2-9 0-8.5-6-14.5-14.5-14.5Z${back ? '' : 'M12.6 21.5a9.4 10.2 0 1 0 18.8 0a9.4 10.2 0 1 0-18.8 0Z'}`}
            fillRule="evenodd"
            {...f}
          />
          {!back && <path d="M13.5 30.5q8.5 5 17 0" fill="none" stroke={INK} strokeWidth="1" opacity="0.5" />}
          <Shade d="M30 8q6 4.5 6.5 12-1 6-2.5 9 1.5-7-.5-13-1.5-5-3.5-8Z" opacity={0.12} />
          <path d="M13 11q3.5-4 9-4.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
        </>
      )
    case 'peci':
      return (
        <>
          <path d="M10.5 14.5 11.5 6Q22 3 32.5 6l1 8.5Q22 12 10.5 14.5Z" fill="#1f2937" {...ink} />
          <path d="M11.5 6Q22 3 32.5 6" fill="none" stroke="white" strokeWidth="1" opacity="0.25" />
          <path d="M11 12.4q11-2.3 22 0" fill="none" stroke={color} strokeWidth="1.2" opacity="0.8" />
        </>
      )
    case 'bandana':
      return (
        <>
          <path d="M8.6 15.5q13.4-5.5 26.8 0l-.4 3.6Q22 13.8 9 19.1Z" {...f} />
          <g fill="white" opacity="0.85">
            {[13, 18, 23, 28, 32].map((x) => (
              <circle key={x} cx={x} cy={15.8 - (x > 22 ? (32 - x) * 0.12 : (x - 13) * 0.12)} r="0.7" />
            ))}
          </g>
          {back && <path d="M20 16.5l-3 6 3-1 2 2 2-2 3 1-3-6Z" {...f} />}
        </>
      )
    case 'hardhat':
      return (
        <>
          <path d="M10 14c0-6.5 5-10.5 12-10.5S34 7.5 34 14Z" fill="#facc15" {...ink} />
          <rect x="7.5" y="12.5" width="29" height="3.6" rx="1.7" fill="#eab308" {...ink} />
          <path d="M22 4v9" stroke="#ca8a04" strokeWidth="2" />
        </>
      )
    default:
      return (
        <>
          <path d="M9.5 15.5C10 8.5 15 4 22 4s12 4.5 12.5 11.5Z" {...f} />
          {!back && <path d="M9 15.5q13 4.5 26 0l-1 2.4q-12 3.8-24 0Z" {...f} />}
          {!back && <circle cx="22" cy="9.5" r="2.2" fill="white" opacity="0.9" />}
        </>
      )
  }
}

// ---------------------------------------------------------------- back

function Back({ look }: { look: Look }) {
  const { hair, style } = look
  const torso = look.outfit === 'labcoat' || look.outfit === 'kemeja' ? '#f8fafc' : look.outfit === 'overall' ? look.pants : look.shirt
  return (
    <>
      <Legs look={look} />
      <g className="pg-arm-a">
        <rect x="7.5" y="32" width="6" height="13" rx="3" style={fill(sleeveOf(look))} {...ink} />
        <LimbLight x={7.5} y={32} w={6} h={13} />
        <circle cx="10.5" cy="45.5" r="2.5" style={fill(look.skin)} {...ink} />
      </g>
      <g className="pg-arm-b">
        <rect x="30.5" y="32" width="6" height="13" rx="3" style={fill(sleeveOf(look))} {...ink} />
        <LimbLight x={30.5} y={32} w={6} h={13} />
        <circle cx="33.5" cy="45.5" r="2.5" style={fill(look.skin)} {...ink} />
      </g>
      <path
        d={look.outfit === 'dress' ? 'M13 37q0-6 6-6h6q6 0 6 6l4.5 14H8.5Z' : look.outfit === 'labcoat' ? 'M11 37q0-6 6-6h10q6 0 6 6v15H11Z' : 'M12 37q0-6 6-6h8q6 0 6 6v10.5q0 2-2 2H14q-2 0-2-2Z'}
        style={fill(torso)}
        {...ink}
      />
      {look.outfit === 'hoodie' && <path d="M15 31.5q7 7.5 14 0v3q-7 6.5-14 0Z" fill="black" opacity="0.14" />}
      {look.outfit === 'flannel' && <Plaid d={BODY} />}
      {look.outfit === 'batik' && <Batik d={BODY} color={look.accent} />}
      {look.outfit === 'explorer' && <path d="M13 37q0-5 5-5h8q5 0 5 5v11H13Z" style={fill(look.accent)} {...ink} strokeWidth={1} />}
      <BodyLight d={BODY} />
      {look.prop === 'skateboard' && <Skateboard x={34} y={44} />}
      <NeckShadow />
      {/* The back of the head is all hair (or skin, for the bald). */}
      <circle cx="22" cy="20" r="13" style={fill(style === 'bald' ? look.skin : hair)} {...ink} />
      <HeadLight />
      {(style === 'long' || style === 'bob') && (
        <path
          d={style === 'long' ? 'M9.5 20q-1 10 1.5 18 5 2.5 11 2.5T33 38q2.5-8 1.5-18Z' : 'M9.5 20q-.5 8 1.5 13h22q2-5 1.5-13Z'}
          style={fill(hair)}
          {...ink}
        />
      )}
      {/* The backpack hangs below the hair, as in a real back view. */}
      {look.backpack && (
        <>
          <rect x="13" y="36.5" width="18" height="13" rx="4.5" style={fill(look.backpack)} {...ink} />
          <path d="M16 43.5h12v3.5q0 1.5-1.5 1.5h-9q-1.5 0-1.5-1.5Z" fill="black" opacity="0.15" stroke={INK} strokeWidth="0.9" />
          <path d="M20 43.5v1.6" stroke={INK} strokeWidth="1" />
        </>
      )}
      {style === 'ponytail' && <path d="M19 27q3 12 3 13 0-1 3-13Z" style={fill(hair)} {...ink} />}
      {style === 'braid' && <Braid x={22} y={31} n={4} f={{ ...fill(hair), ...ink }} />}
      {style === 'buns' && !look.hat && (
        <g style={fill(hair)} {...ink}>
          <circle cx="12.5" cy="8" r="4.6" />
          <circle cx="31.5" cy="8" r="4.6" />
        </g>
      )}
      {style === 'pigtails' && (
        <g style={fill(hair)} {...ink}>
          <path d="M10 24c-5 3-6 11-3 15 2-4 4-8 5-12Z" />
          <path d="M34 24c5 3 6 11 3 15-2-4-4-8-5-12Z" />
        </g>
      )}
      {style === 'bun' && !look.hat && <circle cx="22" cy="5" r="4.5" style={fill(hair)} {...ink} />}
      {style === 'messy' && !look.hat && (
        <>
          <path d="M11 28q-2.5 3-1 5 1.5-2 4-2.5ZM33 28q2.5 3 1 5-1.5-2-4-2.5ZM18 32q2 2.5 4 2 2 .5 4-2Z" style={fill(hair)} {...ink} />
          <path d="M15 11q3 3 7 2M23 9q3 2 6 6" fill="none" stroke={INK} strokeWidth="1" opacity="0.5" />
        </>
      )}
      {look.hat && <HatFront hat={look.hat} color={hatOf(look)} back />}
    </>
  )
}

// ---------------------------------------------------------------- side (facing right)

function Side({ look }: { look: Look }) {
  const { skin, hair, style } = look
  const f = { ...fill(hair), ...ink }
  return (
    <>
      {/* Behind: long hair, ponytail, backpack. */}
      {(style === 'long' || style === 'bob') && (
        <path d={style === 'long' ? 'M11 18q-4 13-1 25h9q-3-12-1-24Z' : 'M11 18q-3 8-1 15h9q-2-8 0-14Z'} {...f} />
      )}
      {style === 'ponytail' && <path d="M12 14c-7 4-7 15-3 21 1-6 3-10 6-13Z" {...f} />}
      {style === 'braid' && <Braid x={12} y={26} n={4} f={f} />}
      {style === 'pigtails' && <path d="M12 22c-5 3-6 11-3 15 2-4 4-8 5-12Z" {...f} />}
      {look.backpack && (
        <>
          <rect x="8" y="33" width="9" height="14.5" rx="3.5" style={fill(look.backpack)} {...ink} />
          <path d="M8 41h9" stroke={INK} strokeWidth="0.9" />
        </>
      )}
      <Legs look={look} side />
      <path
        d={look.outfit === 'dress' ? 'M14 37q0-6 5-6h6q5 0 5 6l3 14H11Z' : look.outfit === 'labcoat' ? 'M13 37q0-6 5-6h8q5 0 5 6v15H13Z' : SIDE_BODY}
        style={fill(look.outfit === 'labcoat' || look.outfit === 'kemeja' ? '#f8fafc' : look.outfit === 'overall' ? look.pants : look.shirt)}
        {...ink}
      />
      {look.outfit === 'flannel' && <Plaid d={SIDE_BODY} />}
      {look.outfit === 'batik' && <Batik d={SIDE_BODY} color={look.accent} />}
      {(look.outfit === 'blazer' || look.outfit === 'kemeja') && <path d="M27 31.8l2.5 4-1.5 7-1.5-1.5Z" style={fill(look.accent)} {...ink} strokeWidth={0.9} />}
      <BodyLight d={SIDE_BODY} />
      {look.outfit === 'explorer' && <path d="M20 31.5h4q5 .5 6 5.5v12.5h-10Z" style={fill(look.accent)} {...ink} strokeWidth={1} />}
      {look.outfit === 'explorer' && <rect x="26" y="37" width="5" height="5.5" rx="1.2" fill="#374151" {...ink} strokeWidth={1} />}
      {look.backpack && <path d="M16.5 31.5q1.5 6 0 13" stroke={INK} strokeWidth="1.6" fill="none" />}
      {look.outfit === 'hoodie' && <path d="M15 32q2.5 4 7 3" fill="none" {...ink} strokeWidth={1.1} />}
      {/* The near arm, swinging (with the skateboard tucked under it). */}
      <g className="pg-arm-a">
        {look.prop === 'skateboard' && (
          <g transform="rotate(90 22 47)">
            <Skateboard x={22} y={47} />
          </g>
        )}
        <rect x="19.5" y="32" width="6" height="13.5" rx="3" style={fill(sleeveOf(look))} {...ink} />
        <LimbLight x={19.5} y={32} w={6} h={13.5} />
        <circle cx="22.5" cy="46" r="2.5" style={fill(skin)} {...ink} />
      </g>

      <NeckShadow cx={23} />
      {/* Head in profile: face to the right, hair over the back. */}
      <circle cx="23" cy="20" r="13" style={fill(skin)} {...ink} />
      <HeadLight cx={23} />
      <g className="pg-face">
        {look.face === 'happy' ? (
          <path d="M27.5 22.5q2-2.4 4 0" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <g className="pg-eyes">
            <ellipse className="pg-eye" cx="29.5" cy="22" rx="1.6" ry={look.face === 'calm' ? 1.5 : 2.4} fill={INK} />
            <circle cx="30" cy="21" r="0.6" fill="white" />
          </g>
        )}
        <ellipse cx="31" cy="26" rx="1.8" ry="1.1" fill="#fb7185" opacity="0.4" />
        {look.mustache ? (
          <path d="M31 27.2q2.5-1.6 4 .2-2 1-4-.2Z" style={fill(hair)} />
        ) : (
          <path d="M32.5 27.6q1 .6 1.8 0" fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
        )}
        {look.glasses && <circle cx="29.5" cy="22" r="3.4" fill="none" stroke={INK} strokeWidth="1.1" />}
      </g>
      {style === 'bald' ? (
        <path d="M11 23q-.5-4 1.5-6" stroke={hair} strokeWidth="3" strokeLinecap="round" fill="none" />
      ) : style === 'curly' || style === 'afro' ? (
        <g {...f}>
          {[
            [13, 12, 5],
            [19, 8, 5.5],
            [25, 7.5, 5],
            [12, 19, 4.5],
            [14, 25, 4],
          ].map(([cx, cy, r]) => (look.hat && cy! < 10 ? null : <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />))}
        </g>
      ) : (
        <>
          {/* Cap of hair over the back of the head, ending in bangs at the front. */}
          <path d="M10.5 28Q8 12 20 7.5q10-2 15 8.5-4.5-2.5-8-1 .5 3-1.5 4.5-1.5-3-5.5-2.5-3 1-3.5 5-2 4-1 7.5Z" {...f} />
          {style === 'spiky' || style === 'mohawk' ? (
            !look.hat && <path d="M12 12l-1-6 4 2 1-5 3.5 4 2-5 2.5 5 3-3 0 5Z" {...f} />
          ) : null}
          {style === 'messy' && !look.hat && (
            <path d="M13 10q-1-4 3-4.5 1.5-3 5.5-2 3.5-1 6 2.5 3.5 1 4 5-3-2-5.5-1-2-2.5-6-2-3.5 0-7 2Z" {...f} />
          )}
        </>
      )}
      {style === 'bun' && !look.hat && <circle cx="16" cy="6.5" r="4.3" {...f} />}
      {style === 'buns' && !look.hat && <circle cx="18" cy="5.5" r="4.4" {...f} />}
      {style !== 'bald' && !look.hat && <HairGloss x={1} />}
      {look.hat && <HatSide hat={look.hat} color={hatOf(look)} />}
    </>
  )
}

function HatSide({ hat, color }: { hat: Hat; color: string }) {
  const f = { ...fill(color), ...ink }
  switch (hat) {
    case 'beanie':
      return (
        <>
          <path d="M9.5 17.5C8.5 7 15.5 2.5 23 2.5s13.5 4.5 13 15Z" {...f} />
          <rect x="8.5" y="13.5" width="29" height="6.5" rx="3.2" {...f} />
          <Shade d="M8.5 16.7h29v.1q0 3.2-3.2 3.2H11.7q-3.2 0-3.2-3.2Z" opacity={0.15} />
          <g stroke={INK} strokeWidth="0.7" opacity="0.35">
            {[12, 15, 18, 21, 24, 27, 30, 33].map((x) => (
              <path key={x} d={`M${x} 14.5v4.5`} />
            ))}
          </g>
        </>
      )
    case 'bucket':
      return (
        <>
          <path d="M13 14.5c0-7 4-10.5 10-10.5s10 3.5 10 10.5Z" {...f} />
          <path d="M6 16q17-5 34 0l-2.5 4.5q-14.5-4-29 0Z" {...f} />
          <path d="M13.3 12.5h19.4" stroke={INK} strokeWidth="1.2" opacity="0.6" />
        </>
      )
    case 'cap':
      return (
        <>
          <path d="M10.5 15.5C11 8.5 16 4 23 4s11.5 4.5 12 11.5Z" {...f} />
          <path d="M33 13.5h7.5a1.8 1.8 0 0 1 0 3.6H33Z" {...f} />
        </>
      )
    case 'hijab':
      return (
        <>
          <path
            d="M30 8C21.5 3.5 9 7.5 8.5 20.5c.2 3.5 1 6 2 8.5-3 2-4 4.5-4 8.5H34c0-3-1-5.5-3.5-7.5C26.5 27.5 25 24 25 20c0-5 1.8-9 5-12Z"
            {...f}
          />
          <path d="M14 11q3.5-4 9-4.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
        </>
      )
    case 'bandana':
      return (
        <>
          <path d="M9.6 15.5q13.4-5.5 26.8 0l-.4 3.6Q23 13.8 10 19.1Z" {...f} />
          <path d="M10.5 17l-4 4.5 3.5-.5 1 3 1.5-6Z" {...f} />
        </>
      )
    case 'guard':
      return (
        <>
          <path d="M10 14C10.5 6.5 16 3 23 3s12 3.5 12.5 11Z" fill="#1e3a5f" {...ink} />
          <rect x="9.5" y="12" width="27" height="3.6" rx="1.5" {...f} />
          <path d="M34 15.6h6.5q-1 2.8-6.5 2.8Z" fill="#0f172a" {...ink} />
        </>
      )
    default:
      // Straw hat, beret and hard hat read the same from the side as from the front.
      return (
        <g transform="translate(1 0)">
          <HatFront hat={hat} color={color} back />
        </g>
      )
  }
}
