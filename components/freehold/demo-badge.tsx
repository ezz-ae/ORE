import { FlaskConical } from 'lucide-react'

/**
 * Explicit "demo data" marker for integration surfaces that render seeded
 * sample data while the real account is not connected. P1.1 de-mock honesty:
 * demo numbers must never be readable as real spend/leads.
 */
export function DemoBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
      <FlaskConical className="h-3 w-3" />
      {label}
    </span>
  )
}

/** Full-width variant: badge + one-line explanation above a demo dataset. */
export function DemoNotice({ badge, note }: { badge: string; note: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
      <DemoBadge label={badge} />
      <span className="text-sm text-slate-400">{note}</span>
    </div>
  )
}
