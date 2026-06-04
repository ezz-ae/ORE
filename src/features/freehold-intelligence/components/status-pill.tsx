import { cn } from "@/lib/utils"

const tones: Record<string, string> = {
  live:        "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  done:        "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  in_progress: "border-[#D4AF37]/25  bg-[#D4AF37]/10  text-[#F8E7AE]",
  planned:     "border-white/10      bg-white/[0.04]  text-white/55",
  pending:     "border-white/10      bg-white/[0.04]  text-white/55",
  blocked:     "border-red-400/25    bg-red-400/10    text-red-300",
  overdue:     "border-red-400/25    bg-red-400/10    text-red-300",
  at_risk:     "border-amber-400/25  bg-amber-400/10  text-amber-200",
  on_track:    "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  complete:    "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  open:        "border-amber-400/25  bg-amber-400/10  text-amber-200",
  resolved:    "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
}

export function StatusPill({ value, className }: { value?: string | null; className?: string }) {
  const key = value || "planned"
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
      tones[key] ?? tones.planned,
      className,
    )}>
      {key.replaceAll("_", " ")}
    </span>
  )
}
