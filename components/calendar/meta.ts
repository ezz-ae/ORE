// Client-safe metadata + date helpers for the calendar board.
// No server imports here — only types from @/lib/calendar (erased at build).
import { Users, User, GraduationCap, Car, FileBarChart2, CheckSquare, PhoneCall, Megaphone, Home } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { AnyKind, CalendarKind, CalendarStatus } from "@/lib/calendar"

// Kinds creatable from the calendar dialog. 'viewing' is intentionally absent:
// a viewing needs a lead, so it is booked from the lead's CRM page instead.
export const CREATE_KINDS: CalendarKind[] = ["roadshow", "team_meeting", "meeting", "training", "car", "report"]

export interface KindMeta {
  labelKey: string
  Icon: LucideIcon
  dot: string
  chip: string
  ring: string
}

export const KIND_META: Record<AnyKind, KindMeta> = {
  viewing: { labelKey: "pcal.kind.viewing", Icon: Home, dot: "bg-teal-400", chip: "bg-teal-400/10 text-teal-300 border-teal-400/20", ring: "border-l-teal-400" },
  roadshow: { labelKey: "pcal.kind.roadshow", Icon: Megaphone, dot: "bg-rose-400", chip: "bg-rose-400/10 text-rose-300 border-rose-400/20", ring: "border-l-rose-400" },
  team_meeting: { labelKey: "pcal.kind.team_meeting", Icon: Users, dot: "bg-gold", chip: "bg-gold/10 text-gold border-gold/20", ring: "border-l-gold" },
  meeting: { labelKey: "pcal.kind.meeting", Icon: User, dot: "bg-sky-400", chip: "bg-sky-400/10 text-sky-300 border-sky-400/20", ring: "border-l-sky-400" },
  training: { labelKey: "pcal.kind.training", Icon: GraduationCap, dot: "bg-violet-400", chip: "bg-violet-400/10 text-violet-300 border-violet-400/20", ring: "border-l-violet-400" },
  car: { labelKey: "pcal.kind.car", Icon: Car, dot: "bg-amber-400", chip: "bg-amber-400/10 text-amber-300 border-amber-400/20", ring: "border-l-amber-400" },
  report: { labelKey: "pcal.kind.report", Icon: FileBarChart2, dot: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", ring: "border-l-emerald-400" },
  task: { labelKey: "pcal.kind.task", Icon: CheckSquare, dot: "bg-slate-400", chip: "bg-slate-400/10 text-slate-300 border-slate-400/20", ring: "border-l-slate-400" },
  followup: { labelKey: "pcal.kind.followup", Icon: PhoneCall, dot: "bg-pink-400", chip: "bg-pink-400/10 text-pink-300 border-pink-400/20", ring: "border-l-pink-400" },
}

export interface StatusMeta {
  labelKey: string
  chip: string
}

export const STATUS_META: Record<CalendarStatus, StatusMeta> = {
  pending: { labelKey: "pcal.status.pending", chip: "bg-amber-400/10 text-amber-300 border-amber-400/20" },
  approved: { labelKey: "pcal.status.approved", chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" },
  declined: { labelKey: "pcal.status.declined", chip: "bg-red-400/10 text-red-300 border-red-400/20" },
  confirmed: { labelKey: "pcal.status.confirmed", chip: "bg-slate-500/10 text-slate-300 border-slate-500/20" },
  cancelled: { labelKey: "pcal.status.cancelled", chip: "bg-slate-600/10 text-slate-500 border-slate-600/20" },
}

// ─── Date helpers (native Date, local time) ──────────────────────────────────

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function isToday(d: Date): boolean {
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

// Six-week grid (Monday-first) covering the cursor month.
export function monthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor)
  const jsDow = first.getDay() // 0=Sun
  const lead = (jsDow + 6) % 7 // Monday-first offset
  const start = new Date(first)
  start.setDate(first.getDate() - lead)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

export function fmtTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export function fmtMonthYear(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" })
}

export function fmtDayLong(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
}

export function fmtRange(startIso: string, endIso: string, allDay: boolean, locale: string): string {
  if (allDay) return fmtDayLong(startIso, locale)
  const s = new Date(startIso)
  const e = new Date(endIso)
  const sameDay = s.toDateString() === e.toDateString()
  const day = s.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
  const st = s.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  const et = e.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  return sameDay ? `${day} · ${st} – ${et}` : `${day} ${st} → ${fmtDayLong(endIso, locale)} ${et}`
}

// Weekday header labels (Monday-first), localized.
export function weekdayLabels(locale: string): string[] {
  const base = new Date(2024, 0, 1) // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d.toLocaleDateString(locale, { weekday: "short" })
  })
}
