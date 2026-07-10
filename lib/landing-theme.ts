// Day / night theming for the public landing page at app/lp/[slug]/page.tsx.
//
// The palette is threaded through the (server-rendered) page the same way the
// trilingual `L` dict and `dir` are. Structural colors (page/section
// backgrounds, card surfaces, borders, and the primary/muted/faint text ramp)
// are driven from `lpPalette(theme)` via inline styles. The gold accent
// (#D4AF37) and semantic colors (WhatsApp green, amber draft banner) are
// intentionally identical in both themes.

export type LpTheme = "day" | "night"

export interface LpPalette {
  /** Root page background. */
  bg: string
  /** Alternating (slightly offset) section background. */
  bgAlt: string
  /** Decorative hero background when no project image is present. */
  bgGradient: string
  /** Card / panel fill. */
  surface: string
  /** Stronger inner-chip / nested fill. */
  surfaceStrong: string
  /** Card / panel border. */
  surfaceBorder: string
  /** Hairline section dividers (border-t between sections, footer rules). */
  divider: string
  /** Primary text (headings). */
  textPrimary: string
  /** Body / secondary text. */
  textMuted: string
  /** Faint labels, captions, disclaimers. */
  textFaint: string
  /** Side gradient laid over a hero image. */
  heroOverlaySide: string
  /** Bottom fade gradient laid over a hero image. */
  heroOverlayBottom: string
  /** Fixed topbar background (translucent). */
  topbarBg: string
  /** Inline hero form / lead-form card background. */
  formBg: string
  /** Input field fill inside forms. */
  inputBg: string
  /** Placeholder / very faint text. */
  placeholder: string
}

const NIGHT: LpPalette = {
  bg: "#06070C",
  bgAlt: "#0A0D16",
  bgGradient:
    "radial-gradient(ellipse 100% 80% at 20% 50%, rgba(212,175,55,0.18) 0%, transparent 55%), radial-gradient(ellipse 60% 60% at 80% 20%, rgba(100,120,200,0.08) 0%, transparent 50%), linear-gradient(135deg, #06070C 0%, #0A0D18 50%, #06070C 100%)",
  surface: "rgba(255,255,255,0.02)",
  surfaceStrong: "rgba(255,255,255,0.05)",
  surfaceBorder: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.06)",
  textPrimary: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",
  heroOverlaySide:
    "linear-gradient(to right, rgba(6,7,12,0.95) 0%, rgba(6,7,12,0.80) 50%, rgba(6,7,12,0.60) 100%)",
  heroOverlayBottom:
    "linear-gradient(to top, #06070C 0%, transparent 60%, transparent 100%)",
  topbarBg: "rgba(6,7,12,0.95)",
  formBg: "rgba(10,13,24,0.90)",
  inputBg: "rgba(255,255,255,0.03)",
  placeholder: "rgba(255,255,255,0.20)",
}

// Polished light "luxury" palette: warm off-white paper, near-black ink, soft
// warm borders — the SAME gold accent as night.
const DAY: LpPalette = {
  bg: "#F7F5F0",
  bgAlt: "#EFEADF",
  bgGradient:
    "radial-gradient(ellipse 100% 80% at 20% 50%, rgba(212,175,55,0.22) 0%, transparent 55%), radial-gradient(ellipse 60% 60% at 80% 20%, rgba(120,110,80,0.06) 0%, transparent 50%), linear-gradient(135deg, #F7F5F0 0%, #FBFAF6 50%, #F0EBE0 100%)",
  surface: "#FFFFFF",
  surfaceStrong: "rgba(11,11,15,0.045)",
  surfaceBorder: "rgba(11,11,15,0.10)",
  divider: "rgba(11,11,15,0.08)",
  textPrimary: "#0B0B0F",
  textMuted: "rgba(11,11,15,0.62)",
  textFaint: "rgba(11,11,15,0.45)",
  heroOverlaySide:
    "linear-gradient(to right, rgba(247,245,240,0.96) 0%, rgba(247,245,240,0.82) 50%, rgba(247,245,240,0.55) 100%)",
  heroOverlayBottom:
    "linear-gradient(to top, #F7F5F0 0%, transparent 60%, transparent 100%)",
  topbarBg: "rgba(247,245,240,0.95)",
  formBg: "rgba(255,255,255,0.94)",
  inputBg: "rgba(11,11,15,0.03)",
  placeholder: "rgba(11,11,15,0.30)",
}

export function lpPalette(theme: LpTheme): LpPalette {
  return theme === "day" ? DAY : NIGHT
}

// Current hour (0–23) in Dubai local time (UTC+4, no DST).
function dubaiHour(): number {
  return (new Date().getUTCHours() + 4) % 24
}

/**
 * Resolve the active theme. An explicit `?theme=day|night` override always
 * wins; otherwise pick by Dubai local time — day 06:00–17:59, night
 * 18:00–05:59.
 */
export function resolveTheme(param: unknown, nowHourDubai?: number): LpTheme {
  const raw = Array.isArray(param) ? param[0] : param
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (s === "day" || s === "night") return s
  const h = typeof nowHourDubai === "number" ? nowHourDubai : dubaiHour()
  return h >= 6 && h < 18 ? "day" : "night"
}
