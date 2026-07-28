"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List, Loader2, Radio, ArrowRight, Lock } from "lucide-react"
import { useT, useI18n } from "@/lib/i18n/provider"
import type { CalendarEvent, AnyKind } from "@/lib/calendar"
import {
  KIND_META, addMonths, startOfMonth, dayKey, isToday, monthGrid,
  fmtMonthYear, fmtTime, weekdayLabels,
} from "./meta"
import { EventDialog } from "./event-dialog"
import { EventDetail } from "./event-detail"

interface Me { email: string; name: string; role: string; isMgmt: boolean }
type View = "month" | "agenda"

const ALL_KINDS: AnyKind[] = ["viewing", "roadshow", "team_meeting", "meeting", "training", "car", "report", "task", "followup"]

export function CalendarBoard() {
  const t = useT()
  const { locale, dir } = useI18n()

  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [me, setMe] = useState<Me>({ email: "", name: "", role: "", isMgmt: false })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>("month")
  const [muted, setMuted] = useState<Set<AnyKind>>(new Set())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [dialogDate, setDialogDate] = useState<string | null>(null)

  const load = useCallback(async () => {
    const first = startOfMonth(cursor)
    const from = new Date(first); from.setDate(first.getDate() - 7)
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); to.setDate(to.getDate() + 7); to.setHours(23, 59, 59)
    setLoading(true)
    try {
      const res = await fetch(`/api/freehold/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      const d = await res.json()
      setEvents(Array.isArray(d.events) ? d.events : [])
      if (d.me) setMe(d.me)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [cursor])

  useEffect(() => { load() }, [load])

  const visible = useMemo(
    () => events.filter((e) => e.status !== "cancelled" && !muted.has(e.kind)),
    [events, muted],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of visible) {
      const k = dayKey(new Date(e.startsAt))
      const list = map.get(k) ?? []
      list.push(e)
      map.set(k, list)
    }
    return map
  }, [visible])

  // Now & Next
  const { nowEvents, nextEvent } = useMemo(() => {
    const t0 = Date.now()
    const live = visible
      .filter((e) => !e.redacted)
      .filter((e) => new Date(e.startsAt).getTime() <= t0 && new Date(e.endsAt).getTime() >= t0)
    const upcoming = visible
      .filter((e) => new Date(e.startsAt).getTime() > t0)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    return { nowEvents: live, nextEvent: upcoming ?? null }
  }, [visible])

  function toggleKind(k: AnyKind) {
    setMuted((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  function openCreate(date?: string) {
    setEditing(null); setDialogDate(date ?? null); setDialogOpen(true)
  }
  function openEdit(e: CalendarEvent) {
    setSelected(null); setEditing(e); setDialogDate(null); setDialogOpen(true)
  }

  const grid = useMemo(() => monthGrid(cursor), [cursor])
  const wd = useMemo(() => weekdayLabels(locale), [locale])
  const monthIndex = cursor.getMonth()

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6" dir={dir}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <CalendarDays className="h-5 w-5 text-gold" />{t("pcal.title")}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">{t("pcal.subtitle")}</p>
        </div>
        <button onClick={() => openCreate()} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright">
          <Plus className="h-4 w-4" />{t("pcal.newEvent")}
        </button>
      </div>

      {/* Now & Next */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
            <Radio className="h-3.5 w-3.5" />{t("pcal.now")}
          </div>
          {nowEvents.length === 0 ? (
            <div className="text-sm text-slate-500">{t("pcal.nothingNow")}</div>
          ) : (
            <div className="space-y-1">
              {nowEvents.slice(0, 3).map((e) => (
                <button key={e.id} onClick={() => setSelected(e)} className="flex w-full items-center gap-2 text-start">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_META[e.kind].dot}`} />
                  <span className="truncate text-sm text-white">{e.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
            <ArrowRight className="h-3.5 w-3.5" />{t("pcal.next")}
          </div>
          {!nextEvent ? (
            <div className="text-sm text-slate-500">{t("pcal.nothingNext")}</div>
          ) : (
            <button onClick={() => setSelected(nextEvent)} className="flex w-full items-center gap-2 text-start">
              <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_META[nextEvent.kind].dot}`} />
              <span className="truncate text-sm text-white">{nextEvent.redacted ? t("pcal.busy") : nextEvent.title}</span>
              <span className="ms-auto shrink-0 text-xs text-slate-500">{fmtTime(nextEvent.startsAt, locale)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-lg border border-line bg-surface p-2 text-slate-400 hover:text-white"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
          <div className="min-w-[140px] text-center text-sm font-semibold text-white">{fmtMonthYear(cursor, locale)}</div>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-lg border border-line bg-surface p-2 text-slate-400 hover:text-white"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
          <button onClick={() => setCursor(startOfMonth(new Date()))} className="ms-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">{t("pcal.today")}</button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
          <button onClick={() => setView("month")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === "month" ? "bg-gold/15 text-white" : "text-slate-400 hover:text-white"}`}><CalendarDays className="h-3.5 w-3.5" />{t("pcal.month")}</button>
          <button onClick={() => setView("agenda")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === "agenda" ? "bg-gold/15 text-white" : "text-slate-400 hover:text-white"}`}><List className="h-3.5 w-3.5" />{t("pcal.agenda")}</button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ALL_KINDS.map((k) => {
          const m = KIND_META[k]
          const on = !muted.has(k)
          return (
            <button key={k} onClick={() => toggleKind(k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? m.chip : "border-line bg-transparent text-slate-600"}`}>
              <span className={`h-2 w-2 rounded-full ${on ? m.dot : "bg-slate-700"}`} />{t(m.labelKey)}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gold" /></div>
      ) : view === "month" ? (
        <MonthView grid={grid} monthIndex={monthIndex} byDay={byDay} weekdays={wd} locale={locale} t={t}
          onDay={(d) => openCreate(d)} onEvent={(e) => setSelected(e)} />
      ) : (
        <AgendaView events={visible} locale={locale} t={t} onEvent={(e) => setSelected(e)} />
      )}

      {dialogOpen && (
        <EventDialog open={dialogOpen} editing={editing} defaultDate={dialogDate} meEmail={me.email}
          onClose={() => setDialogOpen(false)} onSaved={load} />
      )}
      {selected && (
        <EventDetail event={selected} meEmail={me.email} onClose={() => setSelected(null)} onChanged={load} onEdit={openEdit} />
      )}
    </div>
  )
}

function MonthView({
  grid, monthIndex, byDay, weekdays, locale, t, onDay, onEvent,
}: {
  grid: Date[]; monthIndex: number; byDay: Map<string, CalendarEvent[]>; weekdays: string[]; locale: string
  t: (k: string, v?: Record<string, string | number>) => string
  onDay: (d: string) => void; onEvent: (e: CalendarEvent) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-chrome">
      <div className="grid grid-cols-7 border-b border-line bg-surface">
        {weekdays.map((w, i) => (
          <div key={i} className="px-2 py-2 text-center text-[11px] font-medium text-slate-500">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, i) => {
          const k = dayKey(day)
          const inMonth = day.getMonth() === monthIndex
          const list = byDay.get(k) ?? []
          const today = isToday(day)
          return (
            <div key={i} className={`min-h-[92px] border-b border-e border-line p-1.5 sm:min-h-[116px] ${inMonth ? "" : "bg-black/20"}`}>
              <button onClick={() => onDay(k)} className="group flex w-full items-center justify-between">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${today ? "bg-gold text-black" : inMonth ? "text-slate-300" : "text-slate-600"}`}>{day.getDate()}</span>
                <Plus className="h-3 w-3 text-slate-700 opacity-0 transition group-hover:opacity-100" />
              </button>
              <div className="mt-1 space-y-0.5">
                {list.slice(0, 3).map((e) => {
                  const m = KIND_META[e.kind]
                  return (
                    <button key={e.id} onClick={() => onEvent(e)}
                      className={`flex w-full items-center gap-1 truncate rounded border-s-2 bg-surface px-1.5 py-0.5 text-start text-[11px] ${m.ring} ${e.status === "pending" ? "opacity-70" : ""}`}>
                      {e.redacted ? <Lock className="h-2.5 w-2.5 shrink-0 text-slate-500" /> : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`} />}
                      {!e.allDay && !e.redacted && <span className="shrink-0 text-slate-500">{fmtTime(e.startsAt, locale)}</span>}
                      <span className="truncate text-slate-200">{e.redacted ? t("pcal.busy") : e.title}</span>
                    </button>
                  )
                })}
                {list.length > 3 && <div className="ps-1 text-[10px] text-slate-500">{t("pcal.more", { n: list.length - 3 })}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgendaView({
  events, locale, t, onEvent,
}: {
  events: CalendarEvent[]; locale: string
  t: (k: string, v?: Record<string, string | number>) => string
  onEvent: (e: CalendarEvent) => void
}) {
  const now = Date.now()
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.endsAt).getTime() >= now - 86400000).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, now],
  )
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of upcoming) {
      const k = dayKey(new Date(e.startsAt))
      const list = map.get(k) ?? []; list.push(e); map.set(k, list)
    }
    return Array.from(map.entries())
  }, [upcoming])

  if (groups.length === 0) return <div className="rounded-2xl border border-line bg-surface py-16 text-center text-sm text-slate-500">{t("pcal.empty")}</div>

  return (
    <div className="space-y-4">
      {groups.map(([k, list]) => {
        const d = new Date(list[0].startsAt)
        return (
          <div key={k}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className={`text-sm font-semibold ${isToday(d) ? "text-gold" : "text-white"}`}>
                {d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
              </span>
              {isToday(d) && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">{t("pcal.today")}</span>}
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-chrome divide-y divide-line">
              {list.map((e) => {
                const m = KIND_META[e.kind]
                return (
                  <button key={e.id} onClick={() => onEvent(e)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-white/[0.02]">
                    <span className="w-14 shrink-0 text-xs font-medium text-slate-400">{e.allDay || e.redacted ? (e.allDay ? t("pcal.allDay") : "") : fmtTime(e.startsAt, locale)}</span>
                    <span className={`h-8 w-1 shrink-0 rounded-full ${m.dot}`} />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line">
                      {e.redacted ? <Lock className="h-3.5 w-3.5 text-slate-500" /> : <m.Icon className="h-3.5 w-3.5 text-slate-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{e.redacted ? t("pcal.busy") : e.title}</span>
                      {!e.redacted && (e.location || e.externalParty) && <span className="block truncate text-xs text-slate-500">{e.location || e.externalParty}</span>}
                    </span>
                    {e.status === "pending" && <span className="shrink-0 rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">{t("pcal.status.pending")}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
