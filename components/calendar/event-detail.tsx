"use client"

import { useState } from "react"
import Link from "next/link"
import {
  X, MapPin, Users, CalendarClock, Download, Check, XCircle, Pencil, Trash2,
  Ban, ExternalLink, ShieldCheck, Building2, Lock,
} from "lucide-react"
import { toast } from "sonner"
import { useT, useI18n } from "@/lib/i18n/provider"
import type { CalendarEvent, RSVP } from "@/lib/calendar"
import { downloadICS } from "@/lib/calendar-ics"
import { KIND_META, STATUS_META, fmtRange } from "./meta"

interface Props {
  event: CalendarEvent
  meEmail: string
  onClose: () => void
  onChanged: () => void
  onEdit: (e: CalendarEvent) => void
}

export function EventDetail({ event, meEmail, onClose, onChanged, onEdit }: Props) {
  const t = useT()
  const { locale, dir } = useI18n()
  const [busy, setBusy] = useState(false)

  const km = KIND_META[event.kind]
  const sm = STATUS_META[event.status]
  const isVirtual = event.source !== "calendar"
  const myRsvp = event.attendees.find((a) => a.userKey === meEmail)?.rsvp
  const amAttendee = !!myRsvp
  const canRsvp = amAttendee && event.status !== "cancelled" && event.createdBy !== meEmail

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/calendar/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.conflict ? t("pcal.err.conflictAt", { title: d.conflict.title }) : t("pcal.err.conflict"))
        return
      }
      if (!res.ok) { toast.error(t("pcal.err.save")); return }
      toast.success(okMsg)
      onChanged()
      onClose()
    } catch {
      toast.error(t("pcal.err.save"))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/calendar/${event.id}`, { method: "DELETE" })
      if (!res.ok) { toast.error(t("pcal.err.save")); return }
      toast.success(t("pcal.deleted"))
      onChanged()
      onClose()
    } catch {
      toast.error(t("pcal.err.save"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-chrome shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-chrome px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${km.chip}`}>
              {event.redacted ? <Lock className="h-4 w-4" /> : <km.Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">{event.redacted ? t("pcal.busy") : event.title}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${km.chip}`}>{t(km.labelKey)}</span>
                {!isVirtual && event.status !== "confirmed" && (
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${sm.chip}`}>{t(sm.labelKey)}</span>
                )}
                {event.visibility === "private" && !event.redacted && (
                  <span className="inline-flex items-center gap-0.5 rounded-md border border-slate-600/30 bg-slate-600/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"><Lock className="h-2.5 w-2.5" />{t("pcal.private")}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <Row Icon={CalendarClock}>{fmtRange(event.startsAt, event.endsAt, event.allDay, locale)}</Row>

          {event.redacted ? (
            <p className="text-xs text-slate-500">{t("pcal.busyNote")}</p>
          ) : (
            <>
              {event.location && <Row Icon={MapPin}>{event.location}</Row>}
              {event.externalParty && event.kind === "training" && <Row Icon={Building2}>{event.externalParty}</Row>}
              {event.resource && event.kind === "car" && <Row Icon={ShieldCheck}>{event.resource}</Row>}
              {event.createdByName && <Row Icon={Users}><span className="text-slate-400">{t("pcal.organizer")}:</span> {event.createdByName}</Row>}
              {event.description && <p className="whitespace-pre-wrap text-slate-300">{event.description}</p>}

              {event.attendees.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-500">{t("pcal.field.attendees")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {event.attendees.map((a) => (
                      <span key={a.userKey} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-slate-300">
                        {a.userName || a.userKey}
                        {a.rsvp === "accepted" && <Check className="h-3 w-3 text-emerald-400" />}
                        {a.rsvp === "declined" && <XCircle className="h-3 w-3 text-red-400" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {event.status === "declined" && event.decisionNote && (
                <p className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">{event.decisionNote}</p>
              )}
              {event.status === "approved" && event.approvedByName && (
                <p className="text-xs text-emerald-300/80">{t("pcal.approvedBy", { name: event.approvedByName })}</p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!event.redacted && (
          <div className="space-y-2 border-t border-line px-5 py-3">
            {/* Virtual source link */}
            {isVirtual && event.link && (
              <Link href={event.link} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-line-strong">
                <ExternalLink className="h-3.5 w-3.5" />
                {event.source === "task" ? t("pcal.openTask") : t("pcal.openLead")}
              </Link>
            )}

            {/* RSVP */}
            {canRsvp && (
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => patch({ action: "rsvp", rsvp: "accepted" as RSVP }, t("pcal.rsvpAccepted"))}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium ${myRsvp === "accepted" ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-line bg-surface text-slate-300 hover:text-white"}`}>
                  <Check className="h-3.5 w-3.5" />{t("pcal.accept")}
                </button>
                <button disabled={busy} onClick={() => patch({ action: "rsvp", rsvp: "declined" as RSVP }, t("pcal.rsvpDeclined"))}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium ${myRsvp === "declined" ? "border-red-400/40 bg-red-400/15 text-red-300" : "border-line bg-surface text-slate-300 hover:text-white"}`}>
                  <XCircle className="h-3.5 w-3.5" />{t("pcal.decline")}
                </button>
              </div>
            )}

            {/* Approve / decline (management on pending bookings) */}
            {event.approvable && (
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => patch({ action: "approve" }, t("pcal.approved"))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
                  <Check className="h-3.5 w-3.5" />{t("pcal.approve")}
                </button>
                <button disabled={busy} onClick={() => patch({ action: "decline" }, t("pcal.declinedDone"))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-400/20">
                  <Ban className="h-3.5 w-3.5" />{t("pcal.declineBtn")}
                </button>
              </div>
            )}

            {/* ICS + owner controls */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadICS({ id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, location: event.location, description: event.description })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
                <Download className="h-3.5 w-3.5" />{t("pcal.exportIcs")}
              </button>
              {event.editable && (
                <>
                  <button onClick={() => onEdit(event)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />{t("pcal.editBtn")}
                  </button>
                  {event.status !== "cancelled" && (
                    <button disabled={busy} onClick={() => patch({ action: "cancel" }, t("pcal.cancelled"))} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-amber-300/80 hover:text-amber-300">
                      <Ban className="h-3.5 w-3.5" />{t("pcal.cancelEvent")}
                    </button>
                  )}
                  <button disabled={busy} onClick={remove} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-red-300/80 hover:text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />{t("pcal.delete")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ Icon, children }: { Icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-slate-200">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
