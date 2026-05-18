import type { LucideIcon } from "lucide-react"

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string
  value: string
  note: string
  icon?: LucideIcon
}) {
  return (
    <article className="fh-metric">
      <div className="flex items-center justify-between gap-3">
        <p className="fh-metric-label">{label}</p>
        {Icon ? <Icon size={18} color="#c8a95f" aria-hidden="true" /> : null}
      </div>
      <div>
        <p className="fh-metric-value">{value}</p>
        <p className="fh-metric-note">{note}</p>
      </div>
    </article>
  )
}
