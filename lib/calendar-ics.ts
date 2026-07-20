import { BRAND, brandName } from "@/lib/freehold/brand"
// Generate an .ics (iCalendar) file for a single calendar event so any event can
// be exported to Apple Calendar, Google Calendar, Outlook, etc.
// Adapted from the uploaded events-calendar design; rebranded for Freehold.

export interface IcsEvent {
  id: string
  title: string
  startsAt: string | Date
  endsAt: string | Date
  location?: string
  description?: string
  url?: string
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v)
}

function formatUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function escapeText(text: string): string {
  return text.replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n")
}

export function generateICS(event: IcsEvent): string {
  const start = toDate(event.startsAt)
  const end = toDate(event.endsAt)
  const uid = `${event.id || "event"}@${BRAND.domain}`
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brandName}//Calendar//EN`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUTC(new Date())}`,
    `DTSTART:${formatUTC(start)}`,
    `DTEND:${formatUTC(end)}`,
    `SUMMARY:${escapeText(event.title || "Event")}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : "",
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : "",
    event.url ? `URL:${event.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean)
  return lines.join("\r\n")
}

export function downloadICS(event: IcsEvent): void {
  const content = generateICS(event)
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${(event.title || "event").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
