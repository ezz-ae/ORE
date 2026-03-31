const CURRENCY_FORMAT = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
})

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function hasValidCoordinates(lat?: number | null, lng?: number | null): boolean {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return false
  if (lat === 0 && lng === 0) return false
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export function safeNum(val: number | null | undefined, fallback = "—"): string {
  if (!isPositiveNumber(val)) return fallback
  return val.toLocaleString("en-AE")
}

export function safePrice(val: number | null | undefined, fallback = "Price on Request"): string {
  if (!isPositiveNumber(val)) return fallback
  return CURRENCY_FORMAT.format(val)
}

export function safePercent(
  val: number | null | undefined,
  decimals = 1,
  fallback = "—",
): string {
  if (val === null || val === undefined || typeof val !== "number" || !Number.isFinite(val)) {
    return fallback
  }
  return `${val.toFixed(decimals)}%`
}

export function safeROI(
  val: number | null | undefined,
  decimals = 1,
  fallback = "—",
): string {
  return safePercent(val, decimals, fallback)
}

export function safeScore(val: number | null | undefined, fallback = "—"): string {
  if (!isPositiveNumber(val)) return fallback
  return `${Math.round(val)}/100`
}

export function shouldShow(val: any): boolean {
  if (val === null || val === undefined) return false
  if (typeof val === "number" && val === 0) return false
  if (typeof val === "string" && val.trim() === "") return false
  if (Array.isArray(val) && val.length === 0) return false
  return true
}

const AVATAR_COLORS = [
  "#1f2937",
  "#0f172a",
  "#4338ca",
  "#9333ea",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
]

export function nameToColor(name?: string): string {
  if (!name) return AVATAR_COLORS[0]
  const hash = Array.from(name).reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export function getAvatarInitial(name?: string): string {
  if (!name) return "?"
  return name.trim().charAt(0).toUpperCase() || "?"
}
