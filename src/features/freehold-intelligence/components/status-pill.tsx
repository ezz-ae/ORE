import { cn } from "@/lib/utils"

const tones: Record<string, string> = {
  live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  in_progress: "border-blue-400/30 bg-blue-400/10 text-blue-200",
  planned: "border-white/15 bg-white/5 text-white/70",
  pending: "border-white/15 bg-white/5 text-white/70",
  blocked: "border-red-400/30 bg-red-400/10 text-red-200",
  overdue: "border-red-400/30 bg-red-400/10 text-red-200",
  at_risk: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  on_track: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  complete: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  open: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  resolved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
}

export function StatusPill({ value, className }: { value?: string | null; className?: string }) {
  const key = value || "planned"
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize", tones[key] ?? tones.planned, className)}>
      {key.replaceAll("_", " ")}
    </span>
  )
}
