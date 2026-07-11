"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Loader2, Search, Check } from "lucide-react"
import { toast } from "sonner"
import { useT, useI18n } from "@/lib/i18n/provider"
import type { CalendarEvent, CalendarKind } from "@/lib/calendar"
import { CREATE_KINDS, KIND_META } from "./meta"

interface Person { key: string; name: string; email: string; role: string; initials: string }

interface Props {
  open: boolean
  editing: CalendarEvent | null
  defaultDate: string | null // yyyy-mm-dd for a clicked day
  meEmail: string
  onClose: () => void
  onSaved: () => void
}

function pad(n: number) { return String(n).padStart(2, "0") }
function toLocalDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toLocalTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** Combine a yyyy-mm-dd + HH:MM in the user's local zone into a UTC ISO string. */
function localToISO(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

export function EventDialog({ open, editing, defaultDate, meEmail, onClose, onSaved }: Props) {
  const t = useT()
  const { dir } = useI18n()

  const [kind, setKind] = useState<CalendarKind>("team_meeting")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("10:00")
  const [location, setLocation] = useState("")
  const [resource, setResource] = useState("")
  const [externalParty, setExternalParty] = useState("")
  const [description, setDescription] = useState("")
  const [attendees, setAttendees] = useState<Person[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [peopleQuery, setPeopleQuery] = useState("")
  const [saving, setSaving] = useState(false)

  // Reset the form each time the dialog opens (create or edit).
  useEffect(() => {
    if (!open) return
    if (editing) {
      setKind((CREATE_KINDS.includes(editing.kind as CalendarKind) ? editing.kind : "team_meeting") as CalendarKind)
      setTitle(editing.title)
      setDate(toLocalDate(editing.startsAt))
      setAllDay(editing.allDay)
      setStart(toLocalTime(editing.startsAt))
      setEnd(toLocalTime(editing.endsAt))
      setLocation(editing.location)
      setResource(editing.resource)
      setExternalParty(editing.externalParty)
      setDescription(editing.description)
      setAttendees(editing.attendees.map((a) => ({ key: a.userKey, name: a.userName, email: a.userKey, role: "", initials: (a.userName || a.userKey).slice(0, 2).toUpperCase() })))
    } else {
      setKind("team_meeting")
      setTitle("")
      setDate(defaultDate || toLocalDate(new Date().toISOString()))
      setAllDay(false)
      setStart("09:00")
      setEnd("10:00")
      setLocation("")
      setResource("")
      setExternalParty("")
      setDescription("")
      setAttendees([])
    }
    setPeopleQuery("")
  }, [open, editing, defaultDate])

  // Default the vehicle name when switching to a car booking.
  useEffect(() => {
    if (kind === "car" && !resource) setResource(t("pcal.field.vehiclePh"))
  }, [kind, resource])

  // Load the internal directory once when the dialog first opens.
  useEffect(() => {
    if (!open || people.length) return
    fetch("/api/freehold/calendar/people")
      .then((r) => r.json())
      .then((d) => setPeople(Array.isArray(d.people) ? d.people : []))
      .catch(() => setPeople([]))
  }, [open, people.length])

  const filteredPeople = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase()
    return people
      .filter((p) => p.email !== meEmail)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 40)
  }, [people, peopleQuery, meEmail])

  function toggleAttendee(p: Person) {
    setAttendees((prev) => (prev.some((a) => a.key === p.key) ? prev.filter((a) => a.key !== p.key) : [...prev, p]))
  }

  if (!open) return null

  const isApproval = kind === "car" || kind === "training"
  const showAttendees = kind === "team_meeting" || kind === "meeting" || kind === "training"

  async function save() {
    if (!title.trim()) { toast.error(t("pcal.err.title")); return }
    if (!date) { toast.error(t("pcal.err.date")); return }
    const startsAt = allDay ? localToISO(date, "00:00") : localToISO(date, start)
    const endsAt = allDay ? localToISO(date, "23:59") : localToISO(date, end)
    if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) { toast.error(t("pcal.err.range")); return }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        kind,
        startsAt,
        endsAt,
        allDay,
        location: location.trim(),
        resource: resource.trim(),
        externalParty: externalParty.trim(),
        description: description.trim(),
        attendees: attendees.map((a) => ({ userKey: a.key, userName: a.name })),
      }
      const url = editing ? `/api/freehold/calendar/${editing.id}` : "/api/freehold/calendar"
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { action: "edit", ...payload } : payload),
      })
      if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        const c = d.conflict
        toast.error(c ? t("pcal.err.conflictAt", { title: c.title }) : t("pcal.err.conflict"))
        return
      }
      if (!res.ok) { toast.error(t("pcal.err.save")); return }
      toast.success(editing ? t("pcal.saved") : isApproval ? t("pcal.requested") : t("pcal.created"))
      onSaved()
      onClose()
    } catch {
      toast.error(t("pcal.err.save"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-chrome shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-chrome px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{editing ? t("pcal.edit.title") : t("pcal.new.title")}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Kind */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.kind")}</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CREATE_KINDS.map((k) => {
                const m = KIND_META[k]
                const active = kind === k
                return (
                  <button
                    key={k}
                    disabled={!!editing}
                    onClick={() => setKind(k)}
                    className={[
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition",
                      active ? m.chip : "border-line bg-surface text-slate-400 hover:text-slate-200",
                      editing ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <m.Icon className="h-4 w-4" />
                    {t(m.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.titleLabel")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("pcal.field.titlePh")}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none" />
          </div>

          {/* Date + times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.date")}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white focus:border-gold/40 focus:outline-none [color-scheme:dark]" />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-400">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-line bg-surface accent-gold" />
                {t("pcal.field.allDay")}
              </label>
            </div>
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.start")}</label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white focus:border-gold/40 focus:outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.end")}</label>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white focus:border-gold/40 focus:outline-none [color-scheme:dark]" />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.location")}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("pcal.field.locationPh")}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none" />
          </div>

          {/* Car resource */}
          {kind === "car" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.vehicle")}</label>
              <input value={resource} onChange={(e) => setResource(e.target.value)} placeholder={t("pcal.field.vehiclePh")}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none" />
              <p className="mt-1 text-[11px] text-amber-300/70">{t("pcal.hint.carApproval")}</p>
            </div>
          )}

          {/* Training external party */}
          {kind === "training" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.provider")}</label>
              <input value={externalParty} onChange={(e) => setExternalParty(e.target.value)} placeholder={t("pcal.field.providerPh")}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none" />
              <p className="mt-1 text-[11px] text-violet-300/70">{t("pcal.hint.trainingApproval")}</p>
            </div>
          )}

          {/* Attendees */}
          {showAttendees && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                {t("pcal.field.attendees")} {attendees.length > 0 && <span className="text-slate-500">· {attendees.length}</span>}
              </label>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input value={peopleQuery} onChange={(e) => setPeopleQuery(e.target.value)} placeholder={t("pcal.field.attendeesPh")}
                  className="w-full rounded-xl border border-line bg-surface ps-9 pe-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none" />
              </div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-surface p-1">
                {filteredPeople.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">{t("pcal.field.noPeople")}</div>}
                {filteredPeople.map((p) => {
                  const sel = attendees.some((a) => a.key === p.key)
                  return (
                    <button key={p.key} onClick={() => toggleAttendee(p)}
                      className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-sm transition", sel ? "bg-gold/10 text-white" : "text-slate-300 hover:bg-white/5"].join(" ")}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-slate-300">{p.initials}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {sel && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t("pcal.field.notes")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t("pcal.field.notesPh")}
              className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none" />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-chrome px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:text-white">{t("pcal.cancel")}</button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? t("pcal.save") : isApproval ? t("pcal.request") : t("pcal.create")}
          </button>
        </div>
      </div>
    </div>
  )
}
