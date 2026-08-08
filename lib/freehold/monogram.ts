/**
 * THE FOUR COLOURS, MIXED — not themed.
 *
 * A theme built from these was tried and thrown away, and rightly: repainting
 * a working product to carry a palette is the palette wearing the product.
 * A gradient is the other way round. It appears where a flat block of colour
 * was doing nothing anyway — behind a person's initials — and the app fills
 * with the colours by being used, not by being redecorated.
 *
 * NOTHING HERE IS INVENTED. Every stop is one of the four given colours:
 *
 *   #9488ED   #9E7DF0   #50C5CE   #47CCC7
 *
 * The mixes are blends BETWEEN them, at different angles and orders, so a
 * roomful of people reads as one family with no two the same. No new hues, no
 * "close enough" shades, no tints anybody has to approve twice.
 *
 * The blend is chosen from the name, so a person looks the same everywhere in
 * the system — the inbox, the board, the team page, the lead they own. An
 * avatar that changes colour between two screens is not an avatar, it is
 * decoration.
 *
 * Pure — no React, no I/O. Runs in `pnpm guards`.
 */

/** The palette, exactly as given. Nothing else may appear in a blend. */
export const BLEND_COLORS = ['#9488ED', '#9E7DF0', '#50C5CE', '#47CCC7'] as const
export type BlendColor = (typeof BLEND_COLORS)[number]

export interface Blend {
  /** Stops in paint order — two or three of BLEND_COLORS. */
  stops: BlendColor[]
  /** Degrees, so the family does not read as one repeated swatch. */
  angle: number
}

/**
 * Violet into teal in both directions, plus the two three-stop mixes that
 * travel through the middle of the family. Ordered so consecutive names in a
 * list rarely land on near-identical pairs.
 */
export const BLENDS: Blend[] = [
  { stops: ['#9E7DF0', '#47CCC7'], angle: 145 },
  { stops: ['#50C5CE', '#9488ED'], angle: 160 },
  { stops: ['#9488ED', '#47CCC7'], angle: 120 },
  { stops: ['#47CCC7', '#9E7DF0'], angle: 200 },
  { stops: ['#9488ED', '#9E7DF0', '#50C5CE'], angle: 165 },
  { stops: ['#47CCC7', '#50C5CE', '#9E7DF0'], angle: 135 },
]

/**
 * A stable number for a string.
 *
 * Stability is the whole point: the same person must get the same blend on
 * every screen and after every deploy, so this can never become anything
 * random or index-based. (An index into a list that changes length is exactly
 * how this system once pointed at the wrong Meta interest.)
 */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** The blend belonging to a name. Same name in, same blend out, always. */
export function blendFor(name: string): Blend {
  const key = String(name ?? '').trim().toLowerCase()
  if (!key) return BLENDS[0]
  return BLENDS[hash(key) % BLENDS.length]
}

/** The blend as a CSS value, ready for `background`. */
export function blendCss(name: string): string {
  const b = blendFor(name)
  const step = 100 / (b.stops.length - 1)
  const stops = b.stops.map((c, i) => `${c} ${Math.round(i * step)}%`).join(', ')
  return `linear-gradient(${b.angle}deg, ${stops})`
}

/**
 * The letters to show. One word gives one letter, two or more give two — the
 * same rule the rest of the system already uses, kept here so every avatar
 * agrees.
 */
export function initialsOf(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
